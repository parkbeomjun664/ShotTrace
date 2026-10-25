// computeOee 의 규칙을 적어둔다 — 틀려도 에러가 안 나는 곳이라 기계가 매번 확인한다 (M26)
import { describe, expect, it } from "vitest";

import { computeOee } from "./oee";

const base = { runMinutes: 60, lossMinutes: 0, shots: 60, stdCycleSec: 60, goodQty: 60, totalQty: 60 };   // 기본값 — 테스트마다 바꿀 칸만 적는다

describe("computeOee", () => {                         // 묶음 · it 하나 = 규칙 하나 (문장으로)
  it("세 비율을 곱한다", () => {
    const r = computeOee({ runMinutes: 480, lossMinutes: 120, shots: 432, stdCycleSec: 60, goodQty: 410, totalQty: 432 });
    expect(r.availability).toBeCloseTo(0.8);           // 소수는 toBeCloseTo — 0.1 + 0.2 !== 0.3
    expect(r.performance).toBeCloseTo(0.9);
    expect(r.oee).toBeCloseTo(0.8 * 0.9 * (410 / 432));
  });

  it("셋업 · 계획 외 정지는 가동률을 깎는다", () => {
    expect(computeOee({ ...base, lossMinutes: 20 }).availability).toBeCloseTo(60 / 80);   // 020 — 셋업은 손실
  });

  it("느려지면 성능이 떨어진다", () => {
    expect(computeOee({ ...base, shots: 40 }).performance).toBeCloseTo(40 / 60);
  });

  it("100% 를 넘으면 자르고, 자르기 전 값은 남긴다", () => {
    const r = computeOee({ ...base, shots: 80 });
    expect(r.performance).toBe(1);                     // 딱 떨어지는 값은 toBe
    expect(r.performanceRaw).toBeCloseTo(80 / 60);     // 🔴 상한이 숨기는 것을 꺼내둔다 (ADR 016 ②)
  });

  it("안 돌린 날은 0 이 아니라 null", () => {
    const r = computeOee({ ...base, runMinutes: 0, shots: 0, goodQty: 0, totalQty: 0 });
    expect(r.availability).toBeNull();                 // 0% 는 거짓말 — 계산 안 함
    expect(r.performance).toBeNull();
    expect(r.quality).toBeNull();
    expect(r.oee).toBeNull();
  });

  it("표준 사이클타임이 없으면 성능 · OEE 는 null", () => {
    const r = computeOee({ ...base, stdCycleSec: 0 });   // 새 제품 — 잴 기준이 없다
    expect(r.performance).toBeNull();
    expect(r.oee).toBeNull();
  });
});
