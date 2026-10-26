// 연결 상태 한 줄의 규칙 — 두 상태가 같이 보이면 안 된다 (10/26)
import { describe, expect, it } from "vitest";

import { receiveState, 전 } from "./receive";

const now = Date.parse("2026-10-26T12:00:00+09:00");
const ago = (min: number) => new Date(now - min * 60000).toISOString();

describe("receiveState", () => {
  it("연결됐고 최근에 받았으면 live", () => {
    expect(receiveState({ connected: true, lastAt: ago(1), now }).kind).toBe("live");
  });

  it("5분이 넘으면 연결돼 있어도 stale — 끊김이 이긴다", () => {
    expect(receiveState({ connected: true, lastAt: ago(6), now })).toEqual({ kind: "stale", minutes: 6 });
  });

  it("딱 5분은 아직 live — 초과일 때만 끊김", () => {
    expect(receiveState({ connected: true, lastAt: ago(5), now }).kind).toBe("live");
  });

  it("연결이 끊겼고 데이터는 최근이면 offline", () => {
    expect(receiveState({ connected: false, lastAt: ago(1), now }).kind).toBe("offline");
  });

  it("마지막 수신을 모르는 화면(LOT 상세)은 연결만 본다", () => {
    expect(receiveState({ connected: true, now }).kind).toBe("live");
    expect(receiveState({ connected: false, now }).kind).toBe("offline");
  });
});

describe("전", () => {
  it("분 · 시간 · 일로 읽기 쉽게", () => {
    expect(전(3)).toBe("3분 전");
    expect(전(125)).toBe("2시간 전");
    expect(전(26166)).toBe("18일 전");
  });
});
