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
    expect(parseListParams({ sort: "drop table", dir: "sideways" })).toEqual({ defectOnly: false, reason: null, sort: "start", dir: "desc" });
  });
});

// 불량 유형 거르기 (10/27) — 품질 파레토에서 넘어온다 (?reason=가스)
describe("불량 유형", () => {
  const gas = new Map([["B", 3], ["D", 9]]);           // LOT 별 가스 건수 — 없으면 0
  const countOf = (r: { id: string }) => gas.get(r.id) ?? 0;

  it("유형이 오면 그 유형이 많은 순이 기본", () => {
    expect(parseListParams({ reason: "가스" })).toEqual({ defectOnly: false, reason: "가스", sort: "reason", dir: "desc" });
  });

  it("그 유형이 난 LOT 만 · 많은 순", () => {
    expect(applyList(rows, parseListParams({ reason: "가스" }), countOf).map((r) => r.id)).toEqual(["D", "B"]);
  });

  it("유형이 있어도 다른 정렬을 고를 수 있다", () => {
    expect(applyList(rows, parseListParams({ reason: "가스", sort: "start" }), countOf).map((r) => r.id)).toEqual(["D", "B"]);
    expect(applyList(rows, parseListParams({ reason: "가스", sort: "yield", dir: "asc" }), countOf).map((r) => r.id)).toEqual(["B", "D"]);
  });

  it("빈 값 · 너무 긴 값은 유형 없음 · 유형 없이 sort=reason 은 기본 정렬", () => {
    expect(parseListParams({ reason: "  " }).reason).toBeNull();
    expect(parseListParams({ reason: "가".repeat(41) }).reason).toBeNull();
    expect(parseListParams({ sort: "reason" }).sort).toBe("start");
  });
});
