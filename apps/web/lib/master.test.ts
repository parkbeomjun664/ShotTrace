// 마스터 — 사용 중지 항목 · 표준 CT 와 OEE (10/26)
import { describe, expect, it } from "vitest";

import { auditChanges, parseTab, selectable } from "./master";
import { getSpecBand, MIN_TOLERANCE, toleranceFrom } from "./spec";
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

describe("auditChanges", () => {
  it("바뀐 칸만 — 같은 값은 빼고", () => {
    expect(auditChanges({ code: "PM", name: "점검", active: true }, { code: "PM", name: "정기 점검", active: true }))
      .toEqual([{ field: "name", from: "점검", to: "정기 점검" }]);
  });

  it("추가(INSERT)면 모든 칸이 새 값", () => {
    expect(auditChanges(null, { reason: "버", active: true })).toHaveLength(2);
  });
});

describe("toleranceFrom", () => {
  it("DB 값이 상수를 덮는다 — admin 이 금형 폭을 ±2℃ 로 바꾸면 띠도 넓어진다", () => {
    const tol = toleranceFrom([{ metric: "mold_temperature_3", kind: "abs", value: 2 }]);
    expect(getSpecBand("mold_temperature_3", 22, 0, tol)).toEqual({ lo: 20, hi: 24 });
  });

  it("모르는 변수 · 0 이하 값은 버리고, 빠진 변수는 기본값", () => {
    const tol = toleranceFrom([{ metric: "humidity", kind: "abs", value: 9 }, { metric: "cycle_time", kind: "pct", value: 0 }]);
    expect(tol).toEqual(MIN_TOLERANCE);
  });
});
