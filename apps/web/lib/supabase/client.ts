// 브라우저용 Supabase 클라이언트 — Realtime 구독이 여기서 나간다
// session.ts 는 "요청마다 새로", 여기는 "하나로 계속 붙어 있기" — 브라우저는 한 사람 것이다

import { createBrowserClient } from "@supabase/ssr";   // 🔴 세션을 쿠키에서 찾는다 (localStorage 아님)

import type { Database } from "@/types/database";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;      // 🔴 NEXT_PUBLIC_ = 브라우저로 실려 나간다
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; //    service_role 은 여기 절대 금지

if (!url || !key) {                                    // 없으면 시끄럽게 죽는다
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없다. " +
      "브라우저에서 쓰려면 NEXT_PUBLIC_ 접두사가 붙어야 한다.",
  );
}

// 🔴 로그인한 그 사람으로 Realtime 에 붙는다. createClient(supabase-js) 였으면 anon 으로 붙어
//    RLS 를 좁히는 순간 알림이 조용히 끊긴다 (ADR 012 의 남은 것)
export const supabase = createBrowserClient<Database>(url, key);
