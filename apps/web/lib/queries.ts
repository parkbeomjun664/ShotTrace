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

// LOT 하나 — 없으면 null 을 돌려준다 (404 판단은 화면이 한다)
export async function getLot(lotId: string) {
  const { data, error } = await supabase
    .from("production_lot")
    .select(
      "lot_id, plan_date, equip_cd, product_id, total_qty, pass_qty, fail_qty, started_at, ended_at, product(part_name, car_model, side), equipment(equip_name, tonnage)",
    )
    .eq("lot_id", lotId)
    .maybeSingle(); // 0건이면 에러가 아니라 null

  if (error) throw error;
  return data;
}

// ★ 이 프로젝트의 핵심 쿼리 — 시간 구간 조인 (ADR 001 · 005 · 006)
//
//   shot_part  ─(복합 FK)─>  shot
//     품질                    공정변수 24개
//
//   equipment_id + [started_at, ended_at) 로 좁히고
//   product_id 로 한 번 더 좁힌다 — S14 는 한 샷에서 LH·RH 를 같이 찍는다.
//   product_id 를 빼면 정확히 2배가 나온다 (ADR 005).
export async function getLotShots(lot: NonNullable<Awaited<ReturnType<typeof getLot>>>) {
  const { data, error } = await supabase
    .from("shot_part")
    // 🔴 select 문자열은 이어붙이지 않는다. 하나의 리터럴이어야 타입이 붙는다
    .select(
      "part_id, measured_at, part_serial, pass_or_fail, fail_reason, shot(cycle_time, injection_time, max_injection_pressure, max_back_pressure, cushion_position, barrel_temperature_1, barrel_temperature_6, mold_temperature_3)",
    )
    .eq("equipment_id", lot.equip_cd)
    .eq("product_id", lot.product_id)
    .gte("measured_at", lot.started_at) // >= 시작
    .lt("measured_at", lot.ended_at) //    <  끝 — 반열린 구간 (ADR 006)
    .order("measured_at");

  if (error) throw error;
  return data;
}

export type LotShot = Awaited<ReturnType<typeof getLotShots>>[number];

// 불량 사유별 건수 — 많은 순 (파레토, M11)
export function pareto(shots: LotShot[]) {
  const count = new Map<string, number>();
  for (const s of shots) {
    if (s.pass_or_fail !== "N") continue;
    const key = s.fail_reason ?? "사유 없음"; // CHECK 제약이 막지만 타입은 null 허용
    count.set(key, (count.get(key) ?? 0) + 1);
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1]);
}

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
