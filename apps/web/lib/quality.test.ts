// 파레토 누적 비율 — 마지막이 정확히 100 이어야 80% 선이 거짓말을 안 한다 (10/26)
import { describe, expect, it } from "vitest";

import { dailySeries, pareto } from "./quality";

describe("pareto", () => {
  const rows = [
    { fail_reason: "미성형", fail_qty: 15 },
    { fail_reason: "가스", fail_qty: 36 },             // 일부러 순서를 섞어 넘긴다
    { fail_reason: "초기허용불량", fail_qty: 10 },
  ];

  it("많은 순으로 줄 세우고 누적한다", () => {
    const p = pareto(rows);
    expect(p.map((r) => r.reason)).toEqual(["가스", "미성형", "초기허용불량"]);
    expect(p[0].cum).toBeCloseTo((36 / 61) * 100);
    expect(p[1].cum).toBeCloseTo((51 / 61) * 100);   // 두 유형이 80% 를 넘는다 — 파레토가 보여주려는 것
  });

  it("마지막 누적은 정확히 100 — 반올림한 비율을 더하지 않는다", () => {
    expect(pareto(rows).at(-1)!.cum).toBe(100);
  });

  it("건수 0 · null 은 빼고, 불량이 없으면 빈 배열", () => {
    expect(pareto([{ fail_reason: null, fail_qty: 0 }])).toEqual([]);
  });
});

describe("dailySeries", () => {
  const rows = [
    { plan_date: "2020-10-16", yield_pct: 95.47 },
    { plan_date: "2020-10-20", yield_pct: 100 },     // 17 · 18 · 19 일은 생산이 없었다
  ];

  it("빈 날도 하루씩 채운다 — 축이 실제 날짜 간격이 된다", () => {
    expect(dailySeries(rows)).toHaveLength(5);
  });

  it("생산 없는 날은 null — 선이 끊긴다", () => {
    expect(dailySeries(rows).map((d) => d.yield)).toEqual([95.47, null, null, null, 100]);
  });

  it("데이터가 없으면 빈 배열", () => {
    expect(dailySeries([])).toEqual([]);
  });
});
