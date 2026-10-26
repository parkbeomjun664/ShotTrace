// 실적 — 샷 수 차이 경계 · 원장 잇기 (10/26)
import { describe, expect, it } from "vitest";

import { SHOT_DIFF_LIMIT, ledger, shotDiffWarn } from "./records";

describe("shotDiffWarn", () => {
  it("딱 10% 차이는 괜찮다 — 넘으면 경고", () => {
    expect(shotDiffWarn(110, 100)).toBe(false);         // 정확히 10%
    expect(shotDiffWarn(100 * (1 + SHOT_DIFF_LIMIT), 100)).toBe(false);   // 110.00000000000001 — 부동소수점이어도
    expect(shotDiffWarn(111, 100)).toBe(true);
    expect(shotDiffWarn(89, 100)).toBe(true);           // 모자라도
  });

  it("샷 수가 없으면(진행 중 · 0) 비교하지 않는다", () => {
    expect(shotDiffWarn(500, 0)).toBe(false);
  });
});

describe("ledger", () => {
  const t1 = "2026-10-26T01:00:00Z", t2 = "2026-10-26T02:00:00Z";
  const rec = (id: number, at: string, lot = "L1", by = "me") => ({ record_id: id, lot_id: lot, recorded_at: at, recorded_by: by });

  it("정정 — 취소 시각 = 새 줄 시각 · 같은 LOT 으로 짝을 찾는다", () => {
    const rows = ledger([rec(1, t1), rec(2, t2)], [{ record_id: 1, reason: "수량 잘못 입력", canceled_at: t2 }], "me");
    expect(rows[0]).toMatchObject({ canceled: true, replacedBy: 2 });
    expect(rows[1]).toMatchObject({ canceled: false, correctionOf: { record_id: 1, reason: "수량 잘못 입력" } });
  });

  it("다른 LOT 의 같은 시각 줄은 짝이 아니다", () => {
    const rows = ledger([rec(1, t1, "L1"), rec(2, t2, "L2")], [{ record_id: 1, reason: "r", canceled_at: t2 }], "me");
    expect(rows[0]).toMatchObject({ canceled: true, replacedBy: null });
    expect(rows[1].correctionOf).toBeNull();
  });

  it("내가 쓴 줄인지", () => {
    expect(ledger([rec(1, t1, "L1", "me"), rec(2, t1, "L1", "you")], [], "me").map((r) => r.mine)).toEqual([true, false]);
  });
});
