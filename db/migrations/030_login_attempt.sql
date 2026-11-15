-- 030_login_attempt.sql — 로그인 시도 기록 (W1: 로그인 무차별이 접근 로그에 안 보이는 문제)
-- 🔴 로그인은 '비로그인(anon)' 상태에서 일어난다. 그래서 테이블을 직접 열지 않고,
--    좁은 창구(record_login_attempt)로만 한 줄을 넣게 한다. app_role() 과 같은 패턴.

BEGIN;

CREATE TABLE login_attempt (                           -- 로그인 시도 장부 — 스프레이·계정집중을 나중에 이 위에서 판정한다
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    attempted_at  timestamptz NOT NULL DEFAULT now(),
    account       text NOT NULL,                        -- 시도한 이메일(소문자) · 🔴 비밀번호는 저장하지 않는다
    success       boolean NOT NULL,                     -- 성공도 남긴다 — '여러 번 실패 뒤 성공'(침입 신호)을 나중에 본다
    ip            text                                  -- 앱이 넘긴 Vercel 신뢰 IP(x-real-ip) · 없으면 null
);

ALTER TABLE login_attempt ENABLE ROW LEVEL SECURITY;    -- 🔴 anon 은 정책이 없어 0행 — 직접 못 읽고 못 쓴다

CREATE POLICY "read_admin" ON login_attempt             -- 장부는 관리자만 (시도한 이메일 = 개인정보)
    FOR SELECT TO authenticated USING ((SELECT public.app_role()) = 'admin');
-- INSERT · UPDATE · DELETE 정책 없음: 기록은 오직 아래 창구로만 들어온다

CREATE INDEX login_attempt_at_idx ON login_attempt (attempted_at DESC);   -- 최근 N분 거르기용

-- 좁은 투입구 — anon 이 '한 줄 append' 만 할 수 있는 창구. 테이블을 읽거나 뒤질 수는 없다
CREATE FUNCTION record_login_attempt(p_account text, p_success boolean, p_ip text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER                                        -- 🔴 만든 사람 권한 → RLS 를 건너뛰어 한 줄 넣는다
SET search_path = ''                                    -- 🔴 하이재킹 차단 → public. 을 다 붙인다
AS $$
    INSERT INTO public.login_attempt (account, success, ip)
    VALUES (lower(left(coalesce(p_account, ''), 320)),  -- 이메일 길이 상한 · 소문자로 모아 센다
            coalesce(p_success, false),
            left(p_ip, 64));                            -- IP 문자열 상한 (쓰레기 방지)
$$;

-- 🔴 알려진 한계(일부러 안 막음): anon 이 이 창구를 무제한 호출해 장부를 폭주시킬 수 있다.
--    지금 막지 않는다 — 그 폭주 자체가 '과속·스프레이' 신호다. 다음 '판정' 단계에서 그 IP 를 잡는다.
--    (retention: 오래된 행 정리는 판정 단계에서 함께 다룬다)
GRANT EXECUTE ON FUNCTION public.record_login_attempt(text, boolean, text) TO anon, authenticated;

COMMIT;
