// 세션이 들어간 서버용 클라이언트 — 요청마다 새로 만든다 (M19)
import { createServerClient } from "@supabase/ssr";   // 세션을 쿠키에 두는 도구
import { cookies } from "next/headers";                // 이 요청에 딸려 온 쿠키 상자

import type { Database } from "@/types/database";

export async function createSessionClient() {          // 🔴 const 가 아니라 함수 — 손님마다 새 주문서
  const cookieStore = await cookies();                 // 🔴 Next 15+ 는 비동기

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,             // ! = 분명히 있다. 없으면 여기서 터진다
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,        // anon 키 + 쿠키의 신분 = "그 사람" 으로 묻는다
    {
      cookies: {
        getAll() {                                     // 읽기 — 손목밴드를 Supabase 에 보여준다
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {                         // 쓰기 — 로그인 · 토큰 갱신 때 불린다
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {}                                   // 🔴 이유 있는 빈 catch — 서버 컴포넌트는
        },                                             //    쿠키를 못 쓴다. 갱신은 proxy 가 한다
      },
    },
  );
}
