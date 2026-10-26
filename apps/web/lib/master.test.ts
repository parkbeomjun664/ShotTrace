// 마스터 — 사용 중지 항목 · 표준 CT 와 OEE (10/26)
import { describe, expect, it } from "vitest";

import { parseTab, selectable } from "./master";
import { computeOee } from "./oee";

describe("selectable", () => {
  it("사용 중지된 사유는 고르기 목록에서 빠진다", () => {
    const reasons = [
      { code: "BREAKDOWN", active: true },
      { code: "OLD", active: false },
    ];
    expect(selectable(reasons).map((r) => r.code)).toEqual(["BREAKDOWN"]);
  });
});

describe("parseTab", () => {
  it("모르는 탭은 첫 탭(설비)", () => {
    expect(parseTab("product")).toBe("product");
    expect(parseTab("drop table")).toBe("equipment");
    expect(parseTab(undefined)).toBe("equipment");
  });
});

describe("표준 CT 를 바꾸면 OEE 가 다시 계산된다", () => {
  // 마스터의 product.std_cycle_sec → lot_oee_input View(021) → computeOee. 계산기가 표준을 매번 새로 받는다
  const base = { runMinutes: 60, lossMinutes: 0, shots: 50, goodQty: 50, totalQty: 50 };
  it("표준이 짧아지면 같은 샷 수의 성능이 내려간다", () => {
    const before = computeOee({ ...base, stdCycleSec: 60 }).performance!;   // 50 × 60s = 50분 / 60분
    const after = computeOee({ ...base, stdCycleSec: 48 }).performance!;    // 50 × 48s = 40분 / 60분
    expect(before).toBeCloseTo(50 / 60);
    expect(after).toBeCloseTo(40 / 60);
  });
});
