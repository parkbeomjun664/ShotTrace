// DB 조회를 한곳에 모은다 — 화면 컴포넌트가 직접 쿼리하지 않는다
// 담당: M11(View·RPC 로 옮길 자리) · M27(왕복 횟수)
import { supabase } from "@/lib/supabase/server";

// LOT 목록 + 각 LOT 의 제품명을 한 번에 가져온다.
// 🔴 LOT 25건을 받고 제품명을 25번 더 물어보면 왕복 26번이다 (N+1, M27).
//    PostgREST 는 FK 를 따라 한 번에 붙여준다.
export async function getLots() {
  const { data, error } = await supabase
    .from("production_lot")
    .select(
      "lot_id, plan_date, equip_cd, total_qty, pass_qty, fail_qty, started_at, ended_at, product(part_name, car_model, side)",
    )
    .order("started_at", { ascending: false });

  if (error) throw error; // 조용히 빈 화면을 띄우지 않는다 (M04 ⑧)
  return data;
}

export async function getEquipment() {
  const { data, error } = await supabase
    .from("equipment")
    .select("equip_cd, equip_name, tonnage")
    .order("equip_cd");

  if (error) throw error;
  return data;
}

export type Lot = Awaited<ReturnType<typeof getLots>>[number];

// LOT 25건을 합쳐 요약을 만든다.
// ⚫ 지금은 25행이라 서버에서 더해도 된다. 행이 늘면 DB View 로 옮긴다 (M11).
export function summarize(lots: Lot[]) {
  const total = lots.reduce((a, l) => a + l.total_qty, 0);
  const pass = lots.reduce((a, l) => a + l.pass_qty, 0);
  const fail = lots.reduce((a, l) => a + l.fail_qty, 0);
  return {
    total,
    pass,
    fail,
    yield: total ? (pass / total) * 100 : 0, // 0으로 나누기 차단
  };
}

export function byEquipment(lots: Lot[]) {
  const map = new Map<string, { shots: number; fail: number; lots: number }>();
  for (const l of lots) {
    const cur = map.get(l.equip_cd) ?? { shots: 0, fail: 0, lots: 0 };
    map.set(l.equip_cd, {
      shots: cur.shots + l.total_qty,
      fail: cur.fail + l.fail_qty,
      lots: cur.lots + 1,
    });
  }
  return map;
}
