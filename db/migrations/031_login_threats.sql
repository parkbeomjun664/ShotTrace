-- 031_login_threats.sql — 로그인 장부(030)를 읽어 '계정 차원' 공격을 판정한다 (W1)
-- 접근 로그엔 안 보이던 것(ShotTrace 는 실패가 200)을 장부 위에서 잡는다. LogSentry analyze_logins 의 SQL 판.

BEGIN;

CREATE FUNCTION login_threats(
    p_window          interval DEFAULT interval '15 minutes',  -- 최근 이 시간만 본다
    p_spray           int      DEFAULT 5,   -- 스프레이: 한 IP 가 노린 서로 다른 계정 수
    p_account_focus   int      DEFAULT 5    -- 집중: 한 계정을 노린 서로 다른 IP 수
)
RETURNS TABLE (kind text, target text, distinct_n int, since timestamptz)
LANGUAGE sql
STABLE
SECURITY INVOKER            -- 🔴 호출자 권한으로 돈다 → login_attempt 의 read_admin 정책이 그대로 울타리. admin 만 결과를 본다
SET search_path = ''
AS $$
    -- 🔴 1차는 '최근 N분 고정 창'이다. 경계에 걸친 공격(창 끝과 다음 창 시작에 반씩 나뉜 경우)은
    --    두 조각 각각이 문턱 미달이면 샐 수 있다. 슬라이딩 창 최대값(_max_distinct_in_window)은 v2 로 미룬다.

    -- 비밀번호 스프레이 — 한 IP 가 서로 다른 계정 여럿에 실패 (계정마다 1~2회라 잠금도 안 걸리는 가로 공격)
    SELECT '비밀번호 스프레이'::text, ip,
           count(DISTINCT account)::int, now() - p_window
    FROM public.login_attempt
    WHERE NOT success
      AND attempted_at > now() - p_window
      AND ip <> ''                              -- 🔴 빈 IP(미상·로컬)는 IP 기준 판정에서 뺀다 — 가짜 뭉침 방지
    GROUP BY ip
    HAVING count(DISTINCT account) >= p_spray

    UNION ALL

    -- 계정 집중 — 한 계정을 서로 다른 IP 여럿이 실패 (여러 곳에서 한 계정을 노리는 분산 브루트포스)
    SELECT '계정 집중'::text, account,
           count(DISTINCT ip)::int, now() - p_window
    FROM public.login_attempt
    WHERE NOT success
      AND attempted_at > now() - p_window
      AND ip <> ''
    GROUP BY account
    HAVING count(DISTINCT ip) >= p_account_focus
$$;

COMMIT;
