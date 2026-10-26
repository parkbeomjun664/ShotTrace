// LOT 목록 규칙 — 경계값(90 · 95)은 조용히 틀리기 쉬운 곳이다 (10/26)
import { describe, expect, it } from "vitest";

import { applyList, isDemo, parseListParams, yieldLevel } from "./lots";

describe("yieldLevel", () => {
  it("95 이상은 기본 · 95 바로 아래부터 주의", () => {
    expect(yieldLevel(95)).toBe("ok");
    expect(yieldLevel(94.99)).toBe("warn");
  });

  it("90 은 주의 · 90 바로 아래부터 나쁨", () => {
    expect(yieldLevel(90)).toBe("warn");
    expect(yieldLevel(89.99)).toBe("bad");
  });

  it("계산 못 한 수율(null)은 상태가 없다", () => {
    expect(yieldLevel(null)).toBeNull();
  });
});

describe("isDemo", () => {
  it("KAMP 기간 안은 원본 · 밖은 시연", () => {
    expect(isDemo("2020-10-16")).toBe(false);
    expect(isDemo("2020-11-06")).toBe(false);
    expect(isDemo("2026-10-07")).toBe(true);
  });
});

const lot = (id: string, started: string, total: number, fail: number) =>
  ({ id, started_at: started, total_qty: total, pass_qty: total - fail, fail_qty: fail });
const rows = [
  lot("A", "2020-10-20T00:00:00Z", 100, 0),            // 100%
  lot("B", "2020-10-22T00:00:00Z", 100, 15),           // 85%
  lot("C", "2020-10-21T00:00:00Z", 0, 0),              // 계산 안 함
  lot("D", "2020-10-23T00:00:00Z", 100, 5),            // 95%
];

describe("applyList", () => {
  it("기본은 생산 구간 최신순", () => {
    expect(applyList(rows, parseListParams({})).map((r) => r.id)).toEqual(["D", "B", "C", "A"]);
  });

  it("수율 낮은 순 — 계산 못 한 수율은 맨 아래", () => {
    expect(applyList(rows, parseListParams({ sort: "yield", dir: "asc" })).map((r) => r.id)).toEqual(["B", "D", "A", "C"]);
  });

  it("불량 있는 LOT 만", () => {
    expect(applyList(rows, parseListParams({ defect: "1" })).map((r) => r.id)).toEqual(["D", "B"]);
  });

  it("모르는 정렬 값은 기본으로", () => {
    expect(parseListParams({ sort: "drop table", dir: "sideways" })).toEqual({ defectOnly: false, sort: "start", dir: "desc" });
  });
});
