// 브라우저용 Supabase 클라이언트 — Realtime 구독이 여기서 나간다 (M18)
// server.ts 는 "한 번 묻고 끝", client.ts 는 "계속 붙어 있기" 용이다

import { createClient } from "@supabase/supabase-js";  // server.ts 와 같은 함수

import type { Database } from "@/types/database";      // 타입도 그대로 재사용

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;      // 🔴 NEXT_PUBLIC_ = 브라우저로 실려 나간다
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; //    service_role 은 여기 절대 금지

if (!url || !key) {                                    // 없으면 시끄럽게 죽는다 (M04 ⑧)
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없다. " +
      "브라우저에서 쓰려면 NEXT_PUBLIC_ 접두사가 붙어야 한다.",
  );
}

export const supabase = createClient<Database>(url, key);  // 🔵 persistSession 을 끄지 않는다
                                                           //    여기는 브라우저 — 저장할 곳이 있다
