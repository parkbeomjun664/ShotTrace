// 입구 — 요청마다 손목밴드(토큰)를 확인하고, 만료됐으면 갈아준다 (Next 16 의 옛 middleware)
// 🔴 진짜 문지기가 아니다. 막는 건 DB 의 RLS 다
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

import { notifyThreats } from "@/lib/alert";             // 🔵 경로 스캔 알림 (W2) — W1 과 같은 전송
import type { Database } from "@/types/database";

// 흔한 탐침 경로 접두어 — 이걸로 '시작'하는 요청만 경로 스캔 후보로 본다 (W2).
// 🔴 ShotTrace 실제 경로(/lots·/quality·/master…)와 안 겹친다 → 정상 트래픽 오탐 0
const PROBE_PREFIXES = [
  "/.env", "/.git", "/wp-login", "/wp-admin", "/phpmyadmin", "/admin",
  "/.aws", "/.ssh", "/config", "/backup", "/actuator", "/vendor", "/server-status", "/shell",
] as const;

// 탐침 요청을 장부에 남기고 · 이 IP 가 문턱을 넘었나 판정해 넘으면 알림. 🔴 best-effort — 실패해도 요청 흐름 안 막음
async function recordScan(supabase: SupabaseClient<Database>, ip: string, path: string) {
  try {
    await supabase.rpc("record_scan_attempt", { p_ip: ip, p_path: path });
    if (ip) {                                           // 미상 IP(로컬 등)는 판정 불가 — 기록만 되고 판정은 건너뜀
      const { data: hits } = await supabase.rpc("check_scan_alert", { p_ip: ip });
      if (hits?.length) await notifyThreats(hits);
    }
  } catch {
    // 기록·전송 실패가 요청을 막지 않는다
  }
}

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  let response = NextResponse.next({ request });       // let — setAll 에서 다시 만든다

  const supabase = createServerClient<Database>(       // 🔴 여기도 요청마다 새로
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();             // 브라우저가 들고 온 손목밴드
        },
        setAll(cookiesToSet, headers) {                // 갈아줄 때만 불린다
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),          // ① 안쪽(서버 컴포넌트)에 새 밴드 전달
          );
          response = NextResponse.next({ request });   //    바뀐 request 를 담아 응답을 다시 만든다
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),   // ② 브라우저 손목에 새 밴드
          );
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value),          // 🔴 "저장 금지" — 캐시되면 남의 세션이 샌다
          );
        },
      },
    },
  );

  // 🔴 가벼운 선별 — 정상 요청은 접두사 검사 한 번으로 바로 빠진다(edge 부담 0).
  //    탐침이면 응답은 안 늦추고(waitUntil) 뒤에서 기록·판정·통지 (W2)
  const { pathname } = request.nextUrl;
  if (PROBE_PREFIXES.some((p) => pathname.startsWith(p))) {
    const ip = request.headers.get("x-real-ip")?.trim() ?? "";
    event.waitUntil(recordScan(supabase, ip, pathname));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();                   // 🔴 이 줄이 일을 한다 — 갈아주고, 누구인지 본다

  // 로그인 안 했으면 /login 으로 — 빈 화면을 안 보게 하는 친절. 막는 건 RLS 다
  if (!user && !request.nextUrl.pathname.startsWith("/login")) {   // 🔴 /login 은 열어둔다 — 안 그러면 끝없이 돈다
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {                                // 이미지·JS 까지 매번 물으면 느리다
  matcher: ["/((?!_next/static|_next/image|icon.svg|robots.txt|api/health).*)"],   // 🔴 로봇 · 감시 서비스는 로그인을 안 한다 — 튕기면 죽어도 200
  // icon.svg — 탭 아이콘은 로그인 전(로그인 화면)에도 보여야 한다. favicon.ico 대신 (10/27)
};
