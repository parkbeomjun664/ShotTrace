-- 036_ai_guard_event.sql — AI 엔드포인트 보안 사건 장부 (인젝션 ③ 기록 + 경보)
-- ② 교차검증 차단 · ③ 노골적 인젝션 패턴 탐지를 남기고, 같은 구조(원자적 claim·쿨다운)로 Slack 경보.
-- 🔴 createGuide(worker·admin)만 부른다 — anon 아님. 저장(블록)은 앱이 결정, 여기선 기록·경보만.

BEGIN;

CREATE TABLE ai_guard_event (
    id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    at      timestamptz NOT NULL DEFAULT now(),
    lot_id  text,                                   -- 어느 LOT 가이드에서
    kind    text NOT NULL,                          -- '교차검증 차단' | '인젝션 패턴'
    detail  text                                    -- 사유/매칭 마커 · 🔴 비밀·프롬프트 본문 아님
);

ALTER TABLE ai_guard_event ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_admin" ON ai_guard_event
    FOR SELECT TO authenticated USING ((SELECT public.app_role()) = 'admin');
-- 쓰기 정책 없음: 기록은 아래 창구로만 (append-only)

CREATE INDEX ai_guard_event_at_idx ON ai_guard_event (at DESC);

-- 기록 + 원자적 알림 claim (login_alert 범용 장부 재사용). 사건은 늘 남기고, 경보만 쿨다운으로 합친다
CREATE FUNCTION record_ai_guard_event(
    p_lot_id   text,
    p_kind     text,
    p_detail   text,
    p_cooldown interval DEFAULT interval '15 minutes'
)
RETURNS TABLE (alert_kind text, alert_target text, alert_n int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_kind   text;
    v_target text;
BEGIN
    INSERT INTO public.ai_guard_event (lot_id, kind, detail)        -- 🔴 사건은 항상 기록 (쿨다운과 무관)
    VALUES (left(p_lot_id, 64), left(p_kind, 40), left(p_detail, 500));

    v_kind := 'AI 가드 · ' || p_kind;
    v_target := coalesce(nullif(p_lot_id, ''), '(unknown)');
    INSERT INTO public.login_alert (kind, target, last_sent_at)
    VALUES (v_kind, v_target, now())
    ON CONFLICT (kind, target) DO UPDATE SET last_sent_at = now()
    WHERE public.login_alert.last_sent_at < now() - p_cooldown;
    IF found THEN
        alert_kind := v_kind; alert_target := v_target; alert_n := 1; RETURN NEXT;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_ai_guard_event(text, text, text, interval) TO authenticated;

COMMIT;
