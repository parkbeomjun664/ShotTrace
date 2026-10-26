// DB 조회를 한곳에 모은다 · M11(집계는 DB에서) · M27(왕복 횟수)
import type { Database } from "@/types/database";  // DB 스키마 타입
import { createSessionClient } from "@/lib/supabase/session";   // 세션 클라이언트 — RLS 를 진짜로 거친다 (M19)
    // 화면은 직접 쿼리하지 않는다
import { computeOee } from "@/lib/oee";               // 계산기 — DB 는 재료만, 계산은 순수함수가 (M24)
import { GuideSchema } from "@/lib/evidence";
import { selectable } from "@/lib/master";            // 고를 수 있는 항목 — 사용 중지 제외 (10/26)         // 가이드 상자 — 저장된 jsonb 를 꺼낼 때 다시 검사 (M25)

export async function getLots() {                      // LOT 25건 + 각 제품명
  const supabase = await createSessionClient();         // 🔴 함수 안에서 — 요청마다 그 사람으로
  const { data, error } = await supabase               // 성공/실패가 같이 온다
    .from("production_lot")                            // 어느 테이블에서
    .select(                                           // 어떤 컬럼을
      "lot_id, plan_date, equip_cd, total_qty, pass_qty, fail_qty, started_at, ended_at, product(part_name, car_model, side)",
    )                                                  // product(…) ← FK 따라 한 번에
    .order("started_at", { ascending: false });        // 최근 LOT 먼저

  if (error) throw error;                              // 🔴 빈 화면 대신 터뜨린다 (M04 ⑧)
  return data;                                         // 여기 오면 data 는 null 이 아니다
}

export type Lot =                                      // getLots 가 주는 LOT 한 건의 타입
  Awaited<                                             // ① Promise 껍데기를 벗김
    ReturnType<typeof getLots>                         // ② getLots 의 반환 타입
  >[number];                                           // ③ 배열에서 원소 하나
                                                       // 🔴 손으로 안 적는다.
                                                       //    select 를 고치면 자동으로 따라온다

export async function getLot(lotId: string) {          // LOT 한 건 — 상세 화면용
  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from("production_lot")
    .select(                                           // 임베드 2개 — 제품 + 설비
      "lot_id, plan_date, equip_cd, product_id, total_qty, pass_qty, fail_qty, started_at, ended_at, product(part_name, car_model, side, std_cycle_sec), equipment(equip_name, tonnage)",
    )                                                  // product_id 도 같이 — D에서 쓴다
    .eq("lot_id", lotId)                               // WHERE lot_id = ?
    .maybeSingle();                                    // 배열 대신 객체 1개
                                                       // 0건이면 에러가 아니라 null
  if (error) throw error;                              // 진짜 실패만 여기로
  return data;                                         // 없으면 null — 404 판단은 화면이
}


// ★ 이 프로젝트의 핵심 쿼리 — 시간 구간 조인 (ADR 001 · 005 · 006)
type RpcRow = Database["public"]["Functions"]["get_lot_shots"]["Returns"][number];

export type LotShot = Omit<RpcRow, "fail_reason" | "part_id"> & {
  fail_reason: string | null;
  part_id: string | null;                // 007 이후 — CSV 로 들어온 행만 값이 있다
};

export async function getLotShots(lotId: string): Promise<LotShot[]> {
  const supabase = await createSessionClient();
  const { data, error } = await supabase.rpc("get_lot_shots", {
    p_lot_id: lotId,
  });

  if (error) throw error;
  return data;
}


// ── 순수함수 — DB를 안 부른다. 받은 배열만 계산 (M26 테스트 대상) ──
//    summarize · byEquipment 는 006_summary_views.sql 로 옮겼다

export function tally(shots: LotShot[]) {              // LOT 수량을 샷에서 직접 센다
  const total = shots.length;                          // 🔴 production_lot 의 저장값은
  const fail = shots.filter((s) => s.pass_or_fail === "N").length;   //    진행 중이면 낡는다
  const pass = total - fail;                           // 🔵 둘만 세면 나머지는 따라온다
  return { total, pass, fail, yield_pct: total ? (pass / total) * 100 : null };
}                                                      // 🔴 0/0 은 NaN · "계산 안 함" 은 null

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


// ── View 조회 — 집계는 DB가 한다 (M11 · 004_views.sql) ──
//    View 컬럼은 전부 number | null 이다. Postgres 가 NOT NULL 을 보장 못 한다

export async function getDefectPareto() {              // 불량 사유별 (3행)
  const supabase = await createSessionClient();
  const {data, error} = await supabase
    .from("defect_pareto")                             // 테이블처럼 쓴다
    .select("fail_reason, fail_qty, share_pct")        // share_pct 합계 = 100
    .order("fail_qty", { ascending: false });          // 정렬은 여기서 (View엔 없다)

  if (error) throw error;
  return data;
}

export async function getDailyYield() {                // 일별 수율 (13행)
  const supabase = await createSessionClient();
  const {data, error} = await supabase
    .from("daily_yield")
    .select("plan_date, total_qty, pass_qty, fail_qty, yield_pct")
    .order("plan_date");                               // 오름차순 = 시간순
                                                       // 뒤집기는 표시하는 쪽에서
  if (error) throw error;
  return data;
}

export type DefectRow = Awaited<ReturnType<typeof getDefectPareto>>[number];
export type DailyRow = Awaited<ReturnType<typeof getDailyYield>>[number];

export async function getEquipmentSummary() {          // 설비별 (3행) · LEFT JOIN
  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from("equipment_summary")
    .select("equip_cd, equip_name, tonnage, lot_count, total_qty, pass_qty, fail_qty, yield_pct")
    .order("equip_cd");                                // 실적 없는 설비도 나온다

  if (error) throw error;
  return data;
}

export async function getPlantSummary() {             // 공장 전체 (1행)
  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from("plant_summary")
    .select("lot_count, total_qty, pass_qty, fail_qty, yield_pct")
    .maybeSingle();                                    // 항상 1행 — 배열 대신 객체

  if (error) throw error;
  return data;                                         // LOT 0건이면 null
}

export type RecentRecord = { record_id: number; lot_id: string; pass_qty: number; fail_qty: number; recorded_at: string };   // 🔴 View 타입은 전부 | null — 원본이 NOT NULL 이라 덮어쓴다

export async function getLedger() {                  // 원장 — 취소된 줄까지 (10/26 · 취소선 · 정정 잇기는 lib/records.ts)
  const supabase = await createSessionClient();
  const { data: records, error } = await supabase
    .from("production_record")                         // 🔴 active_record 가 아니다 — 취소된 줄도 보여야 이력이 된다
    .select("record_id, lot_id, pass_qty, fail_qty, recorded_at, recorded_by, note")
    .order("recorded_at", { ascending: false })
    .limit(50);
  if (error) throw error;

  const { data: cancels, error: cErr } = await supabase
    .from("record_cancel")
    .select("record_id, reason, canceled_at")
    .in("record_id", records.map((r) => r.record_id));
  if (cErr) throw cErr;
  return { records, cancels };
}

export async function getActiveSums() {               // LOT 별 살아 있는 실적 합계 — 입력 카드의 "기존 기록"
  const supabase = await createSessionClient();
  const { data, error } = await supabase.from("active_record").select("lot_id, pass_qty, fail_qty");
  if (error) throw error;
  const out = new Map<string, { pass: number; fail: number }>();
  for (const r of data) {
    const s = out.get(r.lot_id!) ?? { pass: 0, fail: 0 };
    out.set(r.lot_id!, { pass: s.pass + (r.pass_qty ?? 0), fail: s.fail + (r.fail_qty ?? 0) });
  }
  return out;
}

export async function getRecentRecords() {           // 최근 실적 10건 — 저장하면 바로 아래에
  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from("active_record")                             // 살아 있는 실적 — 취소된 줄은 빠진다 (014)
    .select("record_id, lot_id, pass_qty, fail_qty, recorded_at")
    .order("recorded_at", { ascending: false })        // 🔴 번호(record_id)엔 구멍이 있다 — 순서의 뜻은 시각에
    .limit(10)                                         // 장부는 늘기만 한다 — 처음부터 자른다
    .overrideTypes<RecentRecord[], { merge: false }>();   // "내 말 믿어" — 섞지 않고 통째로 바꾼다

  if (error) throw error;
  return data;
}

export async function getEquipments() {              // 설비 3대 — 비가동 폼의 고르기 목록
  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from("equipment")
    .select("equip_cd, equip_name, tonnage")                    // View 가 아니라 표 — 타입에 | null 이 안 붙는다
    .order("equip_cd");

  if (error) throw error;
  return data;
}

export async function getDowntimeReasons() {         // 고를 수 있는 사유 (017)
  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from("downtime_reason")
    .select("code, name, planned, active")
    .order("planned", { ascending: false })            // 계획된 정지 먼저 —
    .order("name");                                    // 같으면 이름순 (기준 둘을 이어 쓴다)

  if (error) throw error;
  return selectable(data);                             // 🔵 사용 중지된 사유는 새로 못 고른다 — 옛 기록은 계속 가리킨다 (규칙은 lib/master.ts · 테스트)
}

export async function getRecentDowntimes() {         // 최근 비가동 10건
  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from("downtime")
    .select("downtime_id, equip_cd, reason_code, source, started_at, ended_at, note, downtime_reason(name, planned)")   // FK 를 따라 사유 이름까지 한 번에 · source — 직접 입력 / 빈 곳 확정 (026)
    .order("started_at", { ascending: false })
    .limit(50);                                        // 타임라인도 이걸로 그린다 — 10 → 50 (10/26)

  if (error) throw error;
  return data;
}
export async function getUnrecordedStops() {         // 사유 미입력 정지 — LOT 안 샷 간격 > 표준 CT × 5 · 기록된 비가동과 안 겹치는 것 (026 · 10/26)
  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from("unrecorded_stop")
    .select("equip_cd, lot_id, started_at, ended_at, minutes")
    .order("started_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getProducts() {                // 제품 마스터 — 마스터 화면에서 읽기만
  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from("product")
    .select("product_id, part_name, car_model, side, std_cycle_sec")
    .order("product_id");

  if (error) throw error;
  return data;
}

export async function getAllDowntimeReasons() {      // 🔵 active 로 거르지 않는다 — 사용 중지된 것도 보여야 다시 켠다
  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from("downtime_reason")
    .select("code, name, planned, active")
    .order("planned", { ascending: false })
    .order("name");

  if (error) throw error;
  return data;
}

export async function getDefectCodes() {             // 불량 사유 명단 (018)
  const supabase = await createSessionClient();
  const { data, error } = await supabase.from("defect_code").select("reason, active").order("reason");

  if (error) throw error;
  return data;
}

export async function getMyRole() {                  // 함수도 문 — admin 에게만 버튼을 보여주는 데 쓴다 (막는 건 RLS)
  const supabase = await createSessionClient();
  const { data, error } = await supabase.rpc("app_role");

  if (error) throw error;
  return data;
}

export async function getLotBaseline(lotId: string) {   // 차트 기준 범위의 재료 — 이전 정상 LOT 들 (없으면 설비 전체) 양품의 평균 · σ (025 · 10/26)
  const supabase = await createSessionClient();
  const { data, error } = await supabase.rpc("lot_baseline", { p_lot_id: lotId });

  if (error) throw error;
  return data;                                         // 변수마다 한 줄 — 양품이 하나도 없으면 빈 배열
}

export async function getPartsWithoutLot() {          // 어느 LOT 에도 안 든 부품 수 (024) — 현황판 vs 품질 합계 차이의 정체 (10/26)
  const supabase = await createSessionClient();
  const { data, error } = await supabase.from("part_without_lot").select("part_count").maybeSingle();

  if (error) throw error;
  return data?.part_count ?? 0;                        // 집계 1행은 늘 나온다 — 그래도 View 타입은 null 허용
}

export async function getLastReceived() {            // 수집기가 마지막으로 일한 때 — 관측성의 경고등 (M28)
  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from("shot")
    .select("received_at")
    .not("received_at", "is", null)                    // 9월 ETL 적재분은 처리 시각이 없다 — 수집기를 안 거쳤다
    .order("received_at", { ascending: false })        // 🔵 측정 시각이 아니라 처리 시각 (ADR 010) — 재생이 아니면 측정 시각은 2020년
    .limit(1)
    .maybeSingle();                                    // 한 줄이거나 없다

  if (error) throw error;
  return data?.received_at ?? null;
}

export type LotOeeRow = {                              // lot_oee_input 한 줄 — 🔴 View 타입은 전부 | null 이라 덮어쓴다
  lot_id: string;
  equip_cd: string;
  product_id: number;
  std_cycle_sec: number | null;                        // 이것만은 진짜로 비어 있을 수 있다 (새 제품)
  load_minutes: number;
  planned_minutes: number;
  loss_minutes: number;
  shots: number;
  good_qty: number;
};

export async function getLotOee() {                  // LOT 별 OEE — 재료(021 · 022) + computeOee
  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from("lot_oee_input")
    .select("lot_id, equip_cd, product_id, std_cycle_sec, load_minutes, planned_minutes, loss_minutes, shots, good_qty")
    .order("lot_id")
    .overrideTypes<LotOeeRow[], { merge: false }>();

  if (error) throw error;
  return data.map((r) => {
    const input = {
      runMinutes: r.load_minutes - r.planned_minutes - r.loss_minutes,   // 가동 = 부하 − 계획 정지 − 손실
      lossMinutes: r.loss_minutes,                     // 손실은 따로 — 가동률 분모에 들어간다 (계획 정지는 안 들어간다)
      shots: r.shots,
      stdCycleSec: r.std_cycle_sec ?? 0,               // 없으면 0 → computeOee 가 null 로
      goodQty: r.good_qty,
      totalQty: r.shots,                               // LOT 은 제품 하나 — 부품 수 = 샷 수
    };
    return { ...r, input, oee: computeOee(input) };    // input 도 돌려준다 — 전체 합산(aggregateOee)의 재료 (10/26)
  });
}

export async function getLotDowntimes(equipCd: string, startedAt: string, endedAt: string) {   // LOT 시간과 겹친 비가동 — 가이드의 재료 (M25)
  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from("downtime")
    .select("started_at, ended_at, note, downtime_reason(name)")
    .eq("equip_cd", equipCd)
    .lt("started_at", endedAt)                         // 🔵 겹침 = 내 시작 < 남의 끝 AND 내 끝 > 남의 시작 ([시작, 끝) · ADR 006)
    .gt("ended_at", startedAt)
    .order("started_at");

  if (error) throw error;
  const lo = Date.parse(startedAt);
  const hi = Date.parse(endedAt);
  return data.map((d) => ({
    reason: d.downtime_reason?.name ?? "사유 없음",
    minutes: Math.round((Math.min(Date.parse(d.ended_at), hi) - Math.max(Date.parse(d.started_at), lo)) / 60000),   // LOT 안에 든 부분만 (021 의 * 와 같다)
    note: d.note,
  }));
}

export async function getLotGuide(lotId: string) {    // 저장된 가이드 — 있으면 Claude 를 다시 안 부른다 (영수증)
  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from("lot_guide")
    .select("content, model, input_tokens, output_tokens, created_at")
    .eq("lot_id", lotId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  const parsed = GuideSchema.safeParse(data.content);  // 🔴 jsonb 는 무엇이든 담긴다 — 꺼낼 때도 상자를 확인한다
  if (!parsed.success) return null;
  return { ...data, content: parsed.data };
}
export type LotGuide = NonNullable<Awaited<ReturnType<typeof getLotGuide>>>;

export type EquipRow = Awaited<ReturnType<typeof getEquipmentSummary>>[number];
export type PlantRow = Awaited<ReturnType<typeof getPlantSummary>>;
