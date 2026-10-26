// computeOee 의 규칙을 적어둔다 — 틀려도 에러가 안 나는 곳이라 기계가 매번 확인한다 (M26)
import { describe, expect, it } from "vitest";

import { aggregateOee, computeOee, oeeLevel, waterfall } from "./oee";

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

describe("aggregateOee", () => {                       // 여러 LOT — 비율의 평균이 아니라 합의 비율 (10/26)
  it("생산량으로 무게를 단다 — 큰 LOT 이 더 끈다", () => {
    const big = { ...base, runMinutes: 600, shots: 600 };          // 성능 100%
    const tiny = { ...base, runMinutes: 10, shots: 5 };            // 성능 50%
    const r = aggregateOee([big, tiny]);
    expect(r.performance).toBeCloseTo(605 / 610);                  // 평균이면 75% — 1개짜리 LOT 에 끌려간다
  });

  it("표준이 없는 LOT 은 빼고 센다", () => {
    expect(aggregateOee([base, { ...base, stdCycleSec: 0, goodQty: 0 }]).quality).toBe(1);
  });

  it("LOT 이 없으면 null", () => {
    expect(aggregateOee([]).oee).toBeNull();
  });
});

describe("oeeLevel", () => {
  it("85 이상 기본 · 60 이상 주의 · 그 아래 나쁨", () => {
    expect(oeeLevel(0.85)).toBe("ok");
    expect(oeeLevel(0.8499)).toBe("warn");
    expect(oeeLevel(0.6)).toBe("warn");
    expect(oeeLevel(0.5999)).toBe("bad");
    expect(oeeLevel(null)).toBeNull();
  });
});

describe("waterfall", () => {
  it("네 조각을 더하면 계획 시간 100%", () => {
    const w = waterfall({ availability: 0.9, performance: 0.8, performanceRaw: 0.8, quality: 0.95, oee: null });
    expect(w.availabilityLoss + w.performanceLoss + w.qualityLoss + w.oee).toBeCloseTo(1);
    expect(w.oee).toBeCloseTo(0.9 * 0.8 * 0.95);
  });
});
