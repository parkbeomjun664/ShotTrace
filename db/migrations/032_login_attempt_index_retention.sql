-- 032_login_attempt_index_retention.sql — 판정 속도(인덱스) + 장부 정리(retention)

BEGIN;

-- ① 판정용 부분 인덱스 — login_threats 는 'NOT success + 최근 창'만 본다.
--    성공 로그인은 건너뛰고 실패만 시간순으로 → 장부가 커져도 판정이 장부 크기와 무관하게 빠르다.
CREATE INDEX login_attempt_fail_idx
    ON login_attempt (attempted_at DESC)
    WHERE NOT success;
-- (ip·account 인덱스는 지금 안 둔다 — 창 안 결과가 작아 group by 가 싸다. 커지면 그때 EXPLAIN 보고 추가)

-- ⑥ retention — 오래된 시도 정리.
-- 🔴 삭제 '경로'가 생기므로, 공격자가 장부를 못 지우게 anon·authenticated 에는 주지 않는다.
--    정리는 예약 작업(pg_cron)이나 관리자 SQL 로만 부른다. 앱·사용자에게 장부는 여전히 append-only.
CREATE FUNCTION prune_login_attempt(p_keep interval DEFAULT interval '90 days')
RETURNS integer                                         -- 지운 줄 수를 돌려준다
LANGUAGE sql
SECURITY DEFINER                                        -- 소유자 권한 → no-delete 정책을 넘어 정리한다
SET search_path = ''
AS $$
    WITH del AS (
        DELETE FROM public.login_attempt
        WHERE attempted_at < now() - p_keep
        RETURNING 1
    )
    SELECT count(*)::int FROM del;
$$;

REVOKE ALL ON FUNCTION public.prune_login_attempt(interval) FROM PUBLIC;   -- 🔴 anon·authenticated 호출 불가

COMMIT;
