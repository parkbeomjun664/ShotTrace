// 현황판의 연결 상태 한 줄 — 무엇을 보여줄지 정하는 순수함수 (10/26 · M26 테스트 대상)
//
//   🔴 두 상태를 같이 보여주지 않는다 — "실시간 연결됨" 옆에 "신호 없음" 이 붙으면 처음 보는 사람이 헷갈렸다
//   연결(브라우저 ↔ Supabase Realtime)이 살아 있어도 데이터(수집기 → DB)는 끊길 수 있다. 끊긴 쪽이 이긴다

export const STALE_MINUTES = 5;                        // 사이클 1분 — 5분 넘게 샷이 없으면 끊긴 것으로 본다

export type ReceiveKind = "live" | "stale" | "offline";

export function 전(minutes: number) {                  // 26,166분 → "18일 전" — 큰 분 숫자는 읽히지 않는다
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}시간 전`;
  return `${Math.floor(minutes / (60 * 24))}일 전`;
}

export function receiveState({
  connected,
  lastAt,
  now,
}: {
  connected: boolean;                                  // Realtime 채널이 SUBSCRIBED 인가
  lastAt?: string | null;                              // 마지막 수신 시각 — undefined = 이 화면은 모른다(LOT 상세)
  now: number;                                         // 시계는 밖에서 받는다 — 테스트가 시간을 정한다
}): { kind: ReceiveKind; minutes: number | null } {
  if (lastAt) {
    const minutes = Math.round((now - Date.parse(lastAt)) / 60000);
    if (minutes > STALE_MINUTES) return { kind: "stale", minutes };   // 🔴 연결돼 있어도 끊김이 이긴다
    return { kind: connected ? "live" : "offline", minutes };
  }
  return { kind: connected ? "live" : "offline", minutes: null };
}
