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

export type SortKey = "start" | "yield" | "fail";
export type ListParams = { defectOnly: boolean; sort: SortKey; dir: "asc" | "desc" };

export function parseListParams(sp: Record<string, string | string[] | undefined>): ListParams {   // 주소의 ?… → 규칙. 모르는 값은 기본으로
  const sort = sp.sort === "yield" || sp.sort === "fail" ? sp.sort : "start";
  const dir = sp.dir === "asc" ? "asc" : "desc";       // 기본: 최신순(내림차순)
  return { defectOnly: sp.defect === "1", sort, dir };
}

type Row = { started_at: string; total_qty: number; pass_qty: number; fail_qty: number };

export const rateOf = (r: Row) => (r.total_qty ? (r.pass_qty / r.total_qty) * 100 : null);   // 🔴 0 이 아니라 null

export function applyList<T extends Row>(rows: T[], p: ListParams): T[] {
  const kept = p.defectOnly ? rows.filter((r) => r.fail_qty > 0) : rows;
  const key = (r: T) =>
    p.sort === "yield" ? rateOf(r) : p.sort === "fail" ? r.fail_qty : Date.parse(r.started_at);
  return [...kept].sort((a, b) => {                    // 원본 배열은 건드리지 않는다
    const x = key(a), y = key(b);
    if (x === null) return 1;                          // 🔴 계산 못 한 수율은 방향과 상관없이 맨 아래
    if (y === null) return -1;
    return p.dir === "asc" ? x - y : y - x;
  });
}
