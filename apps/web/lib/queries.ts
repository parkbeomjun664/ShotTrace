// DB 조회를 한곳에 모은다 · M11(나중에 View로 옮길 자리) · M27(왕복 횟수)
import { supabase } from "@/lib/supabase/server";      // 화면은 직접 쿼리하지 않는다

export async function getLots() {                      // LOT 25건 + 각 제품명
  const { data, error } = await supabase               // 성공/실패가 같이 온다
    .from("production_lot")                            // 어느 테이블에서
    .select(                                           // 어떤 컬럼을
      "lot_id, plan_date, equip_cd, total_qty, pass_qty, fail_qty, started_at, ended_at, product(part_name, car_model, side)",
    )                                                  // product(…) ← FK 따라 한 번에
    .order("started_at", { ascending: false });        // 최근 LOT 먼저

  if (error) throw error;                              // 🔴 빈 화면 대신 터뜨린다 (M04 ⑧)
  return data;                                         // 여기 오면 data 는 null 이 아니다
}

export async function getEquipment() {                 // 설비 3건 (마스터)
  const { data, error } = await supabase
    .from("equipment")
    .select("equip_cd, equip_name, tonnage")           // FK 임베드 없음 — 붙일 게 없다
    .order("equip_cd");                                // 기본이 오름차순

  if (error) throw error;
  return data;
}

export type Lot =                                      // getLots 가 주는 LOT 한 건의 타입
  Awaited<                                             // ① Promise 껍데기를 벗김
    ReturnType<typeof getLots>                         // ② getLots 의 반환 타입
  >[number];                                           // ③ 배열에서 원소 하나
                                                       // 🔴 손으로 안 적는다.
                                                       //    select 를 고치면 자동으로 따라온다

export async function getLot(lotId: string) {          // LOT 한 건 — 상세 화면용
  const { data, error } = await supabase
    .from("production_lot")
    .select(                                           // 임베드 2개 — 제품 + 설비
      "lot_id, plan_date, equip_cd, product_id, total_qty, pass_qty, fail_qty, started_at, ended_at, product(part_name, car_model, side), equipment(equip_name, tonnage)",
    )                                                  // product_id 도 같이 — D에서 쓴다
    .eq("lot_id", lotId)                               // WHERE lot_id = ?
    .maybeSingle();                                    // 배열 대신 객체 1개
                                                       // 0건이면 에러가 아니라 null
  if (error) throw error;                              // 진짜 실패만 여기로
  return data;                                         // 없으면 null — 404 판단은 화면이
}

// ★ 이 프로젝트의 핵심 쿼리 — 시간 구간 조인 (ADR 001 · 005 · 006)
export async function getLotShots(
  lot: NonNullable<Awaited<ReturnType<typeof getLot>>>,  // getLot 결과에서 null 제외
) {
  const { data, error } = await supabase
    .from("shot_part")                                 // 품질이 있는 쪽에서 출발
    .select(                                           // 🔴 문자열을 이어붙이지 않는다
      "part_id, measured_at, part_serial, pass_or_fail, fail_reason, shot(cycle_time, injection_time, max_injection_pressure, max_back_pressure, cushion_position, barrel_temperature_1, barrel_temperature_6, mold_temperature_3)",
    )                                                  // shot(…) ← 복합 FK 로 공정변수
    .eq("equipment_id", lot.equip_cd)                  // ① 어느 설비        ADR 001
    .eq("product_id", lot.product_id)                  // ② 어느 제품        ADR 005
    .gte("measured_at", lot.started_at)                // ③ >= 시작 ┐
    .lt("measured_at", lot.ended_at)                   //    <  끝  ┘ 반열린  ADR 006
    .order("measured_at");                             // 시간순 — 표가 곧 이력

  if (error) throw error;                              // lot_id FK 는 없다. 시간으로만 이었다
  return data;
}

export type LotShot = Awaited<ReturnType<typeof getLotShots>>[number];

// ── 아래 셋은 DB를 안 부른다. 받은 배열만 계산하는 순수함수 ──
//    async 가 없다 · M11에서 DB View 로 옮길 자리 · M26 테스트 대상

export function pareto(shots: LotShot[]) {             // 불량 사유별 건수, 많은 순
  const count = new Map<string, number>();             // 사유 → 건수
  for (const s of shots) {
    if (s.pass_or_fail !== "N") continue;              // 양품은 건너뛴다
    const key = s.fail_reason ?? "사유 없음";           // CHECK가 막지만 타입은 null 허용
    count.set(key, (count.get(key) ?? 0) + 1);         // 처음이면 0에서 시작
  }
  return [...count.entries()]                          // Map → [[사유, 건수], …]
    .sort((a, b) => b[1] - a[1]);                      // 건수 내림차순 = 파레토
}

export function summarize(lots: Lot[]) {               // LOT 전체를 한 줄 요약으로
  const total = lots.reduce((a, l) => a + l.total_qty, 0);  // a = 누적, l = LOT 한 건
  const pass = lots.reduce((a, l) => a + l.pass_qty, 0);    // 0 = 시작값
  const fail = lots.reduce((a, l) => a + l.fail_qty, 0);
  return {
    total,
    pass,
    fail,
    yield: total ? (pass / total) * 100 : 0,           // 🔴 0으로 나누면 NaN
  };
}

export function byEquipment(lots: Lot[]) {             // 설비별로 묶어서 합계
  const map = new Map<string, { shots: number; fail: number; lots: number }>();
  for (const l of lots) {
    const cur = map.get(l.equip_cd) ?? { shots: 0, fail: 0, lots: 0 };  // 처음이면 0
    map.set(l.equip_cd, {                              // 덮어쓰기 = 누적
      shots: cur.shots + l.total_qty,
      fail: cur.fail + l.fail_qty,
      lots: cur.lots + 1,                              // LOT 개수도 센다
    });
  }
  return map;                                          // 화면에서 map.get("S14")
}
