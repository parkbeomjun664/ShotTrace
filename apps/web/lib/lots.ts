// LOT 목록의 규칙 — 수율 상태 · 시연 LOT · 거르기 · 정렬 (10/26 · M26 테스트 대상)
// 순수함수 — DB 를 안 부른다. 화면(app/lots/page.tsx)은 이걸로 받은 순서대로 그리기만 한다

export type YieldLevel = "ok" | "warn" | "bad";

export function yieldLevel(pct: number | null): YieldLevel | null {   // 경계: 95 이상 기본 · 90 이상 주의 · 그 아래 나쁨
  if (pct === null) return null;                      // 생산 0 — 계산 안 함 (0% 가 아니다)
  if (pct >= 95) return "ok";
  if (pct >= 90) return "warn";
  return "bad";
}

export const KAMP_FROM = "2020-10-16";                 // 원본 데이터의 기간 — 밖이면 실시간 재생(시연)으로 연 LOT
export const KAMP_TO = "2020-11-06";
export const isDemo = (planDate: string) => planDate < KAMP_FROM || planDate > KAMP_TO;   // 'YYYY-MM-DD' 는 글자 비교 = 날짜 비교

export type SortKey = "start" | "yield" | "fail" | "reason";
// reason — 불량 유형 (10/27 · 품질 파레토에서 ?reason=가스 로 넘어온다)
export type ListParams = { defectOnly: boolean; reason: string | null; sort: SortKey; dir: "asc" | "desc" };

export function parseListParams(sp: Record<string, string | string[] | undefined>): ListParams {   // 주소의 ?… → 규칙. 모르는 값은 기본으로
  const raw = typeof sp.reason === "string" ? sp.reason.trim() : "";
  const reason = raw && raw.length <= 40 ? raw : null;   // 빈 값 · 이상하게 긴 값은 유형 없음 (사유 이름은 짧다)
  const sort: SortKey =
    sp.sort === "yield" || sp.sort === "fail" || sp.sort === "start" ? sp.sort
    : reason ? "reason"                                // 유형이 오면 기본은 그 유형이 많은 순 · 유형 없이 reason 은 기본으로
    : "start";
  const dir = sp.dir === "asc" ? "asc" : "desc";       // 기본: 최신순(내림차순)
  return { defectOnly: sp.defect === "1", reason, sort, dir };
}

type Row = { started_at: string; total_qty: number; pass_qty: number; fail_qty: number };

export const rateOf = (r: Row) => (r.total_qty ? (r.pass_qty / r.total_qty) * 100 : null);   // 🔴 0 이 아니라 null

// countOf — LOT 하나의 그 유형 건수 (화면이 lot_defect View 로 만들어 넘긴다). 유형이 없으면 안 쓴다
export function applyList<T extends Row>(rows: T[], p: ListParams, countOf: (r: T) => number = () => 0): T[] {
  let kept = p.defectOnly ? rows.filter((r) => r.fail_qty > 0) : rows;
  if (p.reason) kept = kept.filter((r) => countOf(r) > 0);   // 그 유형이 한 건이라도 난 LOT
  const key = (r: T) =>
    p.sort === "yield" ? rateOf(r)
    : p.sort === "fail" ? r.fail_qty
    : p.sort === "reason" ? countOf(r)
    : Date.parse(r.started_at);
  return [...kept].sort((a, b) => {                    // 원본 배열은 건드리지 않는다
    const x = key(a), y = key(b);
    if (x === null) return 1;                          // 🔴 계산 못 한 수율은 방향과 상관없이 맨 아래
    if (y === null) return -1;
    return p.dir === "asc" ? x - y : y - x;
  });
}
