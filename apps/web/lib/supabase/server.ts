// 서버 컴포넌트에서 쓰는 Supabase 클라이언트
// 담당: M01(RLS·키 구분) · M03(생성한 타입 재사용)
//
// 🔴 anon 키만 쓴다. service_role 키는 RLS를 통째로 우회하므로
//    브라우저로 갈 수 있는 코드 근처에 두지 않는다 (M01 ③).
//    ETL 처럼 서버에서만 도는 스크립트에서만 쓴다.
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 빌드 때 터뜨린다 — 배포 후 흰 화면보다 낫다 (M04 ⑧)
if (!url || !key) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없다. " +
      "로컬은 apps/web/.env.local, 배포는 Vercel 환경변수를 확인한다.",
  );
}

// <Database> 를 넘겨야 select 결과에 타입이 붙는다 (M03)
export const supabase = createClient<Database>(url, key, {
  auth: { persistSession: false }, // 서버에는 저장할 브라우저가 없다
});

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
