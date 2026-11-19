-- 037_login_blocked.sql — 로그인 차단 게이트 (W1: 탐지 → 탐지+차단)
-- 반복 실패가 문턱을 넘은 (ip, account) 또는 스프레이 중인 IP 는 쿨다운(window) 동안 로그인 거부한다.
-- 🔴 계정 집중(여러 IP → 한 계정)은 차단 축에서 뺀다 — 피해자(정상 IP)까지 잠그는 DoS 를 막기 위해.
--    (계정 집중은 login_threats/check_login_alert 로 탐지·경보는 계속 됨)
-- 🔴 읽기 전용(부수효과 없음). 차단된 '시도'의 기록은 앱(login)이 record_login_attempt 로 남긴다.

BEGIN;

CREATE FUNCTION login_blocked(
    p_account   text,
    p_ip        text,
    p_window    interval DEFAULT interval '15 minutes',
    p_threshold int      DEFAULT 5
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER                                        -- login_attempt(admin 전용) 를 읽어야 한다 · anon(login) 이 부른다
SET search_path = ''
AS $$
    SELECT p_ip <> '' AND (
      -- ① 단순 무차별: 이 (ip, account) 가 최근 창에 문턱 이상 실패 → 그 조합 차단
      EXISTS (
        SELECT 1 FROM public.login_attempt
        WHERE ip = p_ip AND account = lower(p_account)
          AND NOT success AND attempted_at > now() - p_window
        HAVING count(*) >= p_threshold
      )
      OR
      -- ② 스프레이: 이 IP 가 최근 창에 서로 다른 계정 여럿 실패 → 그 IP 차단
      EXISTS (
        SELECT 1 FROM public.login_attempt
        WHERE ip = p_ip
          AND NOT success AND attempted_at > now() - p_window
        HAVING count(DISTINCT account) >= p_threshold
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.login_blocked(text, text, interval, int) TO anon, authenticated;

COMMIT;
