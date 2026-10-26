// 품질 화면의 계산 — 파레토 누적 비율 (10/26 · M26 테스트 대상)
// 순수함수 — DB 를 안 부른다. 화면(app/quality)은 받은 줄을 그리기만 한다

export type ParetoRow = { reason: string; count: number; share: number; cum: number };   // share · cum 은 %

// 🔵 비율은 건수에서 다시 계산한다 — View 의 share_pct(소수 둘째 자리 반올림)를 더하면 누적이 100 을 못 채우거나 넘는다
export function pareto(rows: { fail_reason: string | null; fail_qty: number | null }[]): ParetoRow[] {
  const items = rows
    .map((r) => ({ reason: r.fail_reason ?? "사유 없음", count: r.fail_qty ?? 0 }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);               // 파레토 = 많은 순
  const total = items.reduce((a, r) => a + r.count, 0);
  let run = 0;
  return items.map((r) => {
    run += r.count;
    return {
      ...r,
      share: total ? (r.count / total) * 100 : 0,
      cum: total ? (run / total) * 100 : 0,           // 마지막은 정확히 100 — 누적 건수 ÷ 전체
    };
  });
}
