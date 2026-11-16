-- 033_login_alert.sql — 실시간 알림의 DB 절반 (W1 ③: 탐지 → 탐지+통지)
-- 실패 기록 직후 '이 IP·이 계정'만 경량 판정하고, 쿨다운 안이면 한 번만 알리게 claim 한다.
-- 전송(Slack)은 앱이 한다(웹훅 URL = Vercel 환경변수). 여기선 '무엇을 보낼지'만 원자적으로 정한다.

BEGIN;

-- 보낸 알림 장부 — 중복 방지(쿨다운)의 기준. PK=(종류,대상) 으로 같은 위협을 하나로 묶는다
CREATE TABLE login_alert (
    kind         text NOT NULL,                         -- '비밀번호 스프레이' | '계정 집중'
    target       text NOT NULL,                         -- 스프레이=IP · 집중=계정
    last_sent_at timestamptz NOT NULL DEFAULT now(),     -- 마지막으로 보낸 때 — 쿨다운 계산 기준
    PRIMARY KEY (kind, target)
);

ALTER TABLE login_alert ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_admin" ON login_alert               -- 관리자만 조회(감사용). 쓰기는 아래 함수로만
    FOR SELECT TO authenticated USING ((SELECT public.app_role()) = 'admin');
-- INSERT · UPDATE · DELETE 정책 없음

-- 핫패스 인덱스 — 실패 로그인마다 '이 IP / 이 계정'의 최근 창을 센다. 장부 크기와 무관하게 빠르게
CREATE INDEX login_attempt_ip_fail_idx
    ON login_attempt (ip, attempted_at DESC) WHERE NOT success;
CREATE INDEX login_attempt_account_fail_idx
    ON login_attempt (account, attempted_at DESC) WHERE NOT success;

-- 경량 판정 + 원자적 중복방지. 🔴 사용자 입력(account)을 받는 DEFINER → search_path='' · public. 전부 명시
CREATE FUNCTION check_login_alert(
    p_account  text,
    p_ip       text,
    p_window   interval DEFAULT interval '15 minutes',   -- 031 과 같은 기준
    p_spray    int      DEFAULT 5,
    p_focus    int      DEFAULT 5,
    p_cooldown interval DEFAULT interval '15 minutes'
)
RETURNS TABLE (alert_kind text, alert_target text, alert_n int)   -- '보낼 것'만 (🔴 테이블 컬럼 kind·target 과 안 겹치게 접두어)
LANGUAGE plpgsql
SECURITY DEFINER                                         -- login_attempt(admin 전용) 읽고 login_alert 쓰기 위해
SET search_path = ''
AS $$
DECLARE
    v_n int;
BEGIN
    -- 비밀번호 스프레이 — 이 IP 의 최근 창 '서로 다른 계정' 수 (빈 IP=미상 은 건너뜀)
    IF p_ip <> '' THEN
        SELECT count(DISTINCT a.account) INTO v_n
        FROM public.login_attempt a
        WHERE a.ip = p_ip AND NOT a.success
          AND a.attempted_at > now() - p_window;
        IF v_n >= p_spray THEN
            -- 🔴 원자적 claim — 쿨다운 밖(또는 처음)일 때만 줄이 바뀐다 → FOUND=true 면 '내가 보낸다'
            INSERT INTO public.login_alert (kind, target, last_sent_at)
            VALUES ('비밀번호 스프레이', p_ip, now())
            ON CONFLICT (kind, target)
            DO UPDATE SET last_sent_at = now()
            WHERE public.login_alert.last_sent_at < now() - p_cooldown;
            IF found THEN
                alert_kind := '비밀번호 스프레이'; alert_target := p_ip; alert_n := v_n; RETURN NEXT;
            END IF;
        END IF;
    END IF;

    -- 계정 집중 — 이 계정의 최근 창 '서로 다른 IP' 수 (계정은 소문자로 저장됨 → lower 로 맞춘다)
    SELECT count(DISTINCT a.ip) INTO v_n
    FROM public.login_attempt a
    WHERE a.account = lower(p_account) AND NOT a.success
      AND a.ip <> '' AND a.attempted_at > now() - p_window;
    IF v_n >= p_focus THEN
        INSERT INTO public.login_alert (kind, target, last_sent_at)
        VALUES ('계정 집중', lower(p_account), now())
        ON CONFLICT (kind, target)
        DO UPDATE SET last_sent_at = now()
        WHERE public.login_alert.last_sent_at < now() - p_cooldown;
        IF found THEN
            alert_kind := '계정 집중'; alert_target := lower(p_account); alert_n := v_n; RETURN NEXT;
        END IF;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_login_alert(text, text, interval, int, int, interval) TO anon, authenticated;

COMMIT;
