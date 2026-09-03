// 서버 컴포넌트용 Supabase 클라이언트 · M01(키 구분) · M03(타입 재사용)
import { createClient } from "@supabase/supabase-js";  // 진짜 함수 — 실행 후 남는다

import type { Database } from "@/types/database";      // 타입 — 실행되면 사라진다
                                                       // @/ = apps/web/ 별명

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;      // 로컬 .env.local
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // 배포 Vercel 환경변수
                                                       // 🔴 service_role 은 여기 금지
                                                       //    RLS를 통째로 우회한다

if (!url || !key) {                                    // 없으면 시끄럽게 죽는다 (M04 ⑧)
  throw new Error(                                     // 조용히 흰 화면 뜨는 것보다 낫다
    "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없다. " +
      "로컬은 apps/web/.env.local, 배포는 Vercel 환경변수를 확인한다.",
  );
}

export const supabase = createClient<Database>(url, key, {  // <Database> 가 핵심
  auth: { persistSession: false },                     // 서버엔 저장할 브라우저가 없다
});                                                    // 빼면 select 결과가 any 가 된다

export type Tables<T extends keyof Database["public"]["Tables"]> =  // 긴 이름 줄이기
  Database["public"]["Tables"][T]["Row"];              // Tables<"shot"> 으로 쓴다
