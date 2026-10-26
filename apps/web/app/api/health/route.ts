// 헬스체크 — 감시 서비스가 1분마다 부른다. 살아 있으면 200 · 아프면 503 · 데이터는 하나도 안 내보낸다 (M28)
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";                // 🔴 부를 때마다 확인 — 빌드 순간의 "ok" 를 영원히 내보내지 않게

export async function GET() {
  const started = Date.now();
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);   // 쿠키 없는 요청 — 그냥 anon
  const { error } = await supabase.rpc("app_role");    // 비로그인은 null — 에러가 아니면 DB 에 닿았다
  const ms = Date.now() - started;                     // 늘 30ms 이던 게 3초면 죽기 전에 안다

  if (error) return Response.json({ status: "down", db: "error", ms }, { status: 503 });
  return Response.json({ status: "ok", db: "ok", ms });
}
