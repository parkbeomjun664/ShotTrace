// 입구 — 요청마다 손목밴드(토큰)를 확인하고, 만료됐으면 갈아준다 (M19 · Next 16 의 옛 middleware)
// 🔴 진짜 문지기가 아니다. 막는 건 DB 의 RLS 다
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });       // let — setAll 에서 다시 만든다

  const supabase = createServerClient(                 // 🔴 여기도 요청마다 새로
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],   // 🔴 robots.txt 는 건너뛴다 — 로봇은 로그인을 안 한다 (M29)
};
