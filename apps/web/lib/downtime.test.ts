// 비가동 — 겹침 경계 · 타임라인 자리 (10/26)
import { describe, expect, it } from "vitest";

import { PLANNED_CANDIDATE_MIN, dayWindow, hourTicks, isPlannedCandidate, overlaps, parseSelected, segment, withStops } from "./downtime";

describe("overlaps", () => {
  it("딱 붙은 두 구간은 겹침이 아니다 — [시작, 끝) (DB EXCLUDE 와 같다)", () => {
    expect(overlaps({ start: 0, end: 10 }, { start: 10, end: 20 })).toBe(false);
  });

  it("1ms 라도 겹치면 겹침", () => {
    expect(overlaps({ start: 0, end: 10 }, { start: 9, end: 20 })).toBe(true);
  });

  it("안에 쏙 들어가도 겹침", () => {
    expect(overlaps({ start: 0, end: 100 }, { start: 40, end: 50 })).toBe(true);
  });
});

describe("segment", () => {
  const w = { start: 0, end: 200 };

  it("창 안이면 % 자리", () => {
    expect(segment(w, { start: 50, end: 100 })).toEqual({ left: 25, width: 25 });
  });

  it("창에 걸치면 잘라서", () => {
    expect(segment(w, { start: -50, end: 50 })).toEqual({ left: 0, width: 25 });
  });

  it("창 밖이면 그리지 않는다", () => {
    expect(segment(w, { start: 300, end: 400 })).toBeNull();
  });
});

describe("dayWindow", () => {
  it("처음 ~ 끝에 앞뒤 30분 여백", () => {
    const h = 3600_000;
    expect(dayWindow([{ start: 9 * h, end: 12 * h }, { start: 13 * h, end: 17 * h }])).toEqual({ start: 8.5 * h, end: 17.5 * h });
  });

  it("LOT 이 없는 날은 창이 없다", () => {
    expect(dayWindow([])).toBeNull();
  });
});

describe("isPlannedCandidate", () => {
  it("딱 240분부터 계획 정지 후보 — 그 아래는 사유 미입력", () => {
    expect(isPlannedCandidate(PLANNED_CANDIDATE_MIN)).toBe(true);
    expect(isPlannedCandidate(PLANNED_CANDIDATE_MIN - 1)).toBe(false);
  });
});

describe("parseSelected", () => {
  it("설비|시작 시각을 풀고, 틀린 모양 · 중복은 버린다", () => {
    const ok = "S14|2020-10-22T02:21:00+00:00";
    expect(parseSelected([ok, ok, "S14", "S14|아님", "a|b|c"])).toEqual([{ equipCd: "S14", startedAt: "2020-10-22T02:21:00+00:00" }]);
  });
});

describe("hourTicks", () => {
  it("창 안의 정시마다", () => {
    const h = 3600_000;
    expect(hourTicks({ start: 8.5 * h, end: 11.2 * h })).toEqual([9 * h, 10 * h, 11 * h]);
  });
});

describe("withStops", () => {
  it("정지 분을 가동에서 손실로 옮긴다 — 합(부하 시간)은 그대로", () => {
    const r = withStops({ runMinutes: 300, lossMinutes: 0 }, 60);
    expect(r).toEqual({ runMinutes: 240, lossMinutes: 60 });
  });

  it("가동보다 길게 뺄 수는 없다", () => {
    expect(withStops({ runMinutes: 30, lossMinutes: 0 }, 60)).toEqual({ runMinutes: 0, lossMinutes: 30 });
  });
});
