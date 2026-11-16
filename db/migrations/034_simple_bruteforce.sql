-- 034_simple_bruteforce.sql — 세 번째 판정 '단순 무차별' (W1 빈틈 메움)
-- 빈틈: '아이디 그대로, 비밀번호만 바꿔 반복'은 한 (ip, account) 라, 스프레이(서로 다른 계정)·
--       집중(서로 다른 IP) 어디에도 안 걸린다. (운영 검증 중 발견 — 같은 이메일 반복에 경보 없음)
-- 추가: 한 (ip, account) 가 최근 창에 임계 이상 실패하면 경보. 기준은 스프레이·집중과 같은 15분·5(빈 IP 제외).
-- 시그니처·반환 모양 불변 → CREATE OR REPLACE (타입 재생성·앱 변경 불필요). 새 종류는 알림·화면을 그대로 통과.

BEGIN;

-- ── 판정 함수 (031) — UNION ALL 로 '단순 무차별' 한 갈래 추가 ──
CREATE OR REPLACE FUNCTION login_threats(
    p_window          interval DEFAULT interval '15 minutes',
    p_spray           int      DEFAULT 5,
    p_account_focus   int      DEFAULT 5
)
RETURNS TABLE (kind text, target text, distinct_n int, since timestamptz)   -- 🔴 031 과 같은 4칸 (since 포함)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
    -- 비밀번호 스프레이 — 한 IP 가 서로 다른 계정 여럿에 실패
    SELECT '비밀번호 스프레이'::text, ip, count(DISTINCT account)::int, now() - p_window
    FROM public.login_attempt
    WHERE NOT success AND attempted_at > now() - p_window AND ip <> ''
    GROUP BY ip HAVING count(DISTINCT account) >= p_spray

    UNION ALL

    -- 계정 집중 — 한 계정을 서로 다른 IP 여럿이 실패
    SELECT '계정 집중'::text, account, count(DISTINCT ip)::int, now() - p_window
    FROM public.login_attempt
    WHERE NOT success AND attempted_at > now() - p_window AND ip <> ''
    GROUP BY account HAVING count(DISTINCT ip) >= p_account_focus

    UNION ALL

    -- 🆕 단순 무차별 — 한 (ip, account) 의 최근 창 '총 실패 횟수' (같은 아이디·비번만 바꿔 반복)
    SELECT '단순 무차별'::text, account || ' @ ' || ip, count(*)::int, now() - p_window
    FROM public.login_attempt
    WHERE NOT success AND attempted_at > now() - p_window AND ip <> ''
    GROUP BY ip, account HAVING count(*) >= p_spray
$$;

-- ── 알림 함수 (033) — '단순 무차별' 갈래 추가. 원자적 claim·쿨다운은 기존 그대로 ──
CREATE OR REPLACE FUNCTION check_login_alert(
    p_account  text,
    p_ip       text,
    p_window   interval DEFAULT interval '15 minutes',
    p_spray    int      DEFAULT 5,
    p_focus    int      DEFAULT 5,
    p_cooldown interval DEFAULT interval '15 minutes'
)
RETURNS TABLE (alert_kind text, alert_target text, alert_n int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_n      int;
    v_target text;
BEGIN
    -- 비밀번호 스프레이
    IF p_ip <> '' THEN
        SELECT count(DISTINCT a.account) INTO v_n
        FROM public.login_attempt a
        WHERE a.ip = p_ip AND NOT a.success AND a.attempted_at > now() - p_window;
        IF v_n >= p_spray THEN
            INSERT INTO public.login_alert (kind, target, last_sent_at)
            VALUES ('비밀번호 스프레이', p_ip, now())
            ON CONFLICT (kind, target) DO UPDATE SET last_sent_at = now()
            WHERE public.login_alert.last_sent_at < now() - p_cooldown;
            IF found THEN
                alert_kind := '비밀번호 스프레이'; alert_target := p_ip; alert_n := v_n; RETURN NEXT;
            END IF;
        END IF;
    END IF;

    -- 계정 집중
    SELECT count(DISTINCT a.ip) INTO v_n
    FROM public.login_attempt a
    WHERE a.account = lower(p_account) AND NOT a.success
      AND a.ip <> '' AND a.attempted_at > now() - p_window;
    IF v_n >= p_focus THEN
        INSERT INTO public.login_alert (kind, target, last_sent_at)
        VALUES ('계정 집중', lower(p_account), now())
        ON CONFLICT (kind, target) DO UPDATE SET last_sent_at = now()
        WHERE public.login_alert.last_sent_at < now() - p_cooldown;
        IF found THEN
            alert_kind := '계정 집중'; alert_target := lower(p_account); alert_n := v_n; RETURN NEXT;
        END IF;
    END IF;

    -- 🆕 단순 무차별 — 이 (ip, account) 의 최근 창 총 실패 횟수
    IF p_ip <> '' THEN
        SELECT count(*) INTO v_n
        FROM public.login_attempt a
        WHERE a.ip = p_ip AND a.account = lower(p_account) AND NOT a.success
          AND a.attempted_at > now() - p_window;
        IF v_n >= p_spray THEN
            v_target := lower(p_account) || ' @ ' || p_ip;
            INSERT INTO public.login_alert (kind, target, last_sent_at)
            VALUES ('단순 무차별', v_target, now())
            ON CONFLICT (kind, target) DO UPDATE SET last_sent_at = now()
            WHERE public.login_alert.last_sent_at < now() - p_cooldown;
            IF found THEN
                alert_kind := '단순 무차별'; alert_target := v_target; alert_n := v_n; RETURN NEXT;
            END IF;
        END IF;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_login_alert(text, text, interval, int, int, interval) TO anon, authenticated;

COMMIT;
