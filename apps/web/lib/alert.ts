// 보안 알림 전송 — 위협을 웹훅으로 보낸다 (Slack/Discord/범용 HTTP). LogSentry send_webhook 과 같은 모양.
//   🔴 URL 은 환경변수(SECURITY_ALERT_WEBHOOK) — 저장소에 없음. 없으면 off (아무것도 안 보냄)
//   🔴 본문엔 종류·대상·건수만 — 비밀번호·토큰 등 민감정보 금지
//   🔴 best-effort — 전송 실패가 로그인·기록을 막지 않는다 (호출부도 try/catch, 여기도 한 번 더)

// check_login_alert() 가 돌려주는 '보낼 위협' 한 건
export type Threat = { alert_kind: string; alert_target: string; alert_n: number };

export async function notifyThreats(hits: Threat[]): Promise<void> {
  const url = process.env.SECURITY_ALERT_WEBHOOK;
  if (!url || hits.length === 0) return;                 // off 스위치 — URL 없으면 조용히 끝

  const lines = hits.map((h) => `🔴 ${h.alert_kind} — ${h.alert_target} · 최근 15분 ${h.alert_n}건`);
  const text = `[ShotTrace] 로그인 위협 ${hits.length}건\n${lines.join("\n")}`;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),                    // Slack 호환: {"text": ...}
      signal: AbortSignal.timeout(5000),                 // 5초 넘게 매달리지 않는다
    });
  } catch {
    // 전송 실패는 삼킨다 — 감시가 로그인을 막으면 안 된다 (LogSentry 와 같은 원칙)
  }
}
