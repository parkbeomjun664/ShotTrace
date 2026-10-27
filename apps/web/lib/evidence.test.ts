// 가이드의 근거 숫자 규칙 — 화면이 Claude 옆에 붙이는 숫자라 조용히 틀리면 안 된다
import { describe, expect, it } from "vitest";

import { GuideSchema, defectPositions, metricStats } from "./evidence";
import type { LotShot } from "./queries";

const shot = (pass: "Y" | "N", cycle: number | null) =>   // 바꿀 칸만 — 나머지 변수는 같은 값
  ({ pass_or_fail: pass, cycle_time: cycle }) as unknown as LotShot;

const cycle = (shots: LotShot[]) => metricStats(shots).find((m) => m.key === "cycle_time")!;

describe("metricStats", () => {
  it("불량 평균이 양품의 흔들림 몇 배 벗어났는지(z) 센다", () => {
    const m = cycle([shot("Y", 10), shot("Y", 12), shot("N", 15)]);   // 양품 평균 11 · 표준편차 √2
    expect(m.goodMean).toBeCloseTo(11);
    expect(m.failMean).toBeCloseTo(15);
    expect(m.z).toBeCloseTo(4 / Math.SQRT2);
  });

  it("null 은 0 으로 세지 않고 뺀다", () => {
    expect(cycle([shot("Y", 10), shot("Y", null), shot("Y", 12), shot("N", 15)]).goodMean).toBeCloseTo(11);
  });

  it("양품이 흔들리지 않으면(표준편차 0) z 는 null — 0 으로 나누지 않는다", () => {
    expect(cycle([shot("Y", 10), shot("Y", 10), shot("N", 15)]).z).toBeNull();
  });
});

describe("defectPositions", () => {
  it("순번은 받은 순서가 아니라 시간 순서로 센다", () => {
    const at = (pass: "Y" | "N", iso: string) =>
      ({ pass_or_fail: pass, measured_at: iso, fail_reason: pass === "N" ? "가스" : null }) as unknown as LotShot;
    const shots = [                                    // 일부러 뒤섞어 넘긴다 — 🔴 받은 순서로 세면 1번, 시간 순서면 2번 (같으면 테스트가 아무것도 못 지킨다)
      at("N", "2020-10-27T09:11:00+09:00"),
      at("Y", "2020-10-27T09:12:00+09:00"),
      at("Y", "2020-10-27T09:10:40+09:00"),
    ];
    expect(defectPositions(shots, "2020-10-27T09:10:40+09:00")).toEqual([
      { shot_no: 2, minutes_from_start: 0, reason: "가스" },   // 20초 → 0분 (반올림)
    ]);
  });
});

describe("GuideSchema", () => {
  it("목록에 없는 변수를 근거로 대면 받지 않는다", () => {
    const r = GuideSchema.safeParse({
      summary: "s",
      causes: [{ title: "t", metric: "humidity", reasoning: "r", check: "c" }],   // 우리가 준 적 없는 변수
    });
    expect(r.success).toBe(false);
  });
});
