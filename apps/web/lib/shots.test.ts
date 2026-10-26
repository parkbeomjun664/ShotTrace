// 빈 구간 · 기준 범위 판정 — 경계(딱 5배 · 범위 끝)는 조용히 틀리기 쉬운 곳이다 (10/26)
import { describe, expect, it } from "vitest";

import type { LotShot } from "./queries";
import { getSpecBand } from "./spec";
import { GAP_FACTOR, axisDomain, findGaps, gapLabel, indexGaps, indexTicks, isAnomaly, niceTicks, outOfBand, tickLabels } from "./shots";

const CT = 60;                                         // 표준 사이클타임 60초
const s = (sec: number) => sec * 1000;

describe("findGaps", () => {
  it("딱 표준 CT × 5 는 아직 정상 — 넘어야 빈 구간", () => {
    expect(findGaps([s(0), s(CT * GAP_FACTOR)], CT)).toEqual([]);
    expect(findGaps([s(0), s(CT * GAP_FACTOR + 1)], CT)).toHaveLength(1);
  });

  it("첫 샷 앞 · 마지막 샷 뒤는 보지 않는다 — 샷 사이만", () => {
    const gaps = findGaps([s(0), s(60), s(60 + 3600), s(60 + 3660)], CT);   // 가운데 한 시간만 빈다
    expect(gaps).toEqual([{ x1: s(60), x2: s(3660), minutes: 60 }]);
  });

  it("순서가 섞여 와도 시간 순서로 본다", () => {
    expect(findGaps([s(3600), s(0)], CT)).toHaveLength(1);
  });

  it("표준이 없으면 기준이 없다 — 빈 구간도 없다", () => {
    expect(findGaps([s(0), s(99999)], 0)).toEqual([]);
  });
});

describe("outOfBand · isAnomaly", () => {
  const band = { lo: 10, hi: 20 };

  it("범위 끝은 안 · 넘으면 밖", () => {
    expect(outOfBand(10, band)).toBe(false);
    expect(outOfBand(20, band)).toBe(false);
    expect(outOfBand(9.99, band)).toBe(true);
    expect(outOfBand(20.01, band)).toBe(true);
  });

  it("범위가 없거나 값이 없으면 밖이 아니다", () => {
    expect(outOfBand(999, null)).toBe(false);
    expect(outOfBand(null, band)).toBe(false);
  });

  it("불량이면 값이 범위 안이어도 이상 샷", () => {
    const shot = { pass_or_fail: "N", cycle_time: 15 } as unknown as LotShot;
    const none = { cycle_time: null, max_injection_pressure: null, barrel_temperature_1: null, mold_temperature_3: null };
    expect(isAnomaly(shot, none)).toBe(true);
  });
});

describe("indexGaps · gapLabel", () => {
  it("순번 축에서 빈 구간은 두 샷 사이(i + 0.5)에 — 딱 5배는 아직 정상", () => {
    expect(indexGaps([s(0), s(CT * GAP_FACTOR), s(CT * GAP_FACTOR * 2 + 1)], CT)).toEqual([{ at: 2.5, minutes: 5 }]);
  });

  it("라벨은 분 · 시간으로", () => {
    expect(gapLabel(11)).toBe("샷 없음 11분");
    expect(gapLabel(125)).toBe("샷 없음 2시간 5분");
  });
});

describe("axisDomain · niceTicks", () => {
  it("기준 범위와 데이터를 합치고 10% 여백", () => {
    const [lo, hi] = axisDomain([10, 20], { lo: 5, hi: 15 });   // 5 ~ 20 → 폭 15 · 여백 1.5
    expect(lo).toBeCloseTo(3.5);
    expect(hi).toBeCloseTo(21.5);
  });

  it("눈금은 4 ~ 5개 · 표시한 글자가 겹치지 않는다", () => {
    for (const d of [[53.6, 65.5], [274.8, 277.6], [21.9, 22.05], [0, 1000]] as [number, number][]) {
      const { ticks, decimals } = niceTicks(d);
      const shown = ticks.map((t) => t.toFixed(decimals));
      expect(ticks.length).toBeGreaterThanOrEqual(3);
      expect(ticks.length).toBeLessThanOrEqual(6);
      expect(new Set(shown).size).toBe(shown.length);
    }
  });

  it("폭이 좁으면 자릿수를 늘린다", () => {
    expect(niceTicks([21.9, 22.05]).decimals).toBe(2);
    expect(niceTicks([274.8, 277.6]).decimals).toBe(1);
  });
});

describe("indexTicks", () => {
  it("같은 시각 글자는 한 번만", () => {
    const labels = ["09:10", "09:10", "09:11", "09:12", "09:12", "09:13"];
    const t = indexTicks(labels, 6);
    expect(new Set(t.map((i) => labels[i - 1])).size).toBe(t.length);
  });
});

describe("getSpecBand", () => {
  it("σ 가 0 이어도 최소 허용 폭은 있다 — 금형 ±1℃", () => {
    expect(getSpecBand("mold_temperature_3", 22, 0)).toEqual({ lo: 21, hi: 23 });
  });

  it("3σ 가 최소 폭보다 넓으면 3σ", () => {
    expect(getSpecBand("barrel_temperature_1", 276, 1)).toEqual({ lo: 273, hi: 279 });   // 3σ = 3 > 2
  });

  it("비율 기준은 평균에 비례 — 사이클 1%", () => {
    const b = getSpecBand("cycle_time", 60, 0.03)!;                                       // 3σ = 0.09 < 0.6
    expect(b.lo).toBeCloseTo(59.4);
    expect(b.hi).toBeCloseTo(60.6);
  });

  it("띠 끝 값은 이탈이 아니다 — 띠와 판정이 같은 경계", () => {
    const b = getSpecBand("mold_temperature_3", 22, 0);
    expect(outOfBand(23, b)).toBe(false);
    expect(outOfBand(23.0001, b)).toBe(true);
  });

  it("평균이 없으면 범위도 없다", () => {
    expect(getSpecBand("cycle_time", null, null)).toBeNull();
  });
});

describe("tickLabels", () => {
  it("앞 눈금과 날짜가 같으면 시:분만, 바뀌면 날짜도", () => {
    const dates = ["10. 07.", "10. 07.", "10. 08.", "10. 08."];
    const times = ["09:29", "09:53", "08:02", "08:15"];
    expect([...tickLabels([1, 2, 3, 4], dates, times).values()]).toEqual(["10. 07. 09:29", "09:53", "10. 08. 08:02", "08:15"]);
  });
});
