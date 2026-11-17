-- 035_scan_attempt.sql — 경로 스캔 탐지 (W2): 없는 주소가 307 이라 안 보이던 스캔을 '탐침 경로'로 잡는다
-- W1 과 대칭 — 로그인 실패 대신 '탐침 경로 요청'을 장부에 기록 → 판정 → 통지. 🔴 상태코드(307/404) 무관, 경로 패턴만.

BEGIN;

-- ① login_alert 가 이제 로그인 전용이 아님을 명시 (경로 스캔 알림도 kind='경로 스캔' 으로 여기 들어온다)
COMMENT ON TABLE login_alert IS
    '범용 보안 알림 장부 (로그인 위협 + 경로 스캔 등). PK (kind,target) 로 쿨다운 기준. 쓰기는 check_*_alert 함수로만';

-- 탐침 요청 장부 — '탐침 패턴에 걸린 요청'만 쌓인다 (전체 요청 아님). 🔴 쿼리·본문 없음
CREATE TABLE scan_attempt (
    id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    at    timestamptz NOT NULL DEFAULT now(),
    ip    text,                                       -- Vercel x-real-ip (middleware 가 넘김) · 없으면 null/빈값
    path  text NOT NULL                               -- 매칭된 전체 경로 (/.git/config 등)
);

ALTER TABLE scan_attempt ENABLE ROW LEVEL SECURITY;    -- 🔴 anon 0행 — 직접 못 읽고 못 씀
CREATE POLICY "read_admin" ON scan_attempt
    FOR SELECT TO authenticated USING ((SELECT public.app_role()) = 'admin');
-- INSERT·UPDATE·DELETE 정책 없음: 기록은 record_scan_attempt 창구로만 (append-only)

CREATE INDEX scan_attempt_ip_at_idx ON scan_attempt (ip, at DESC);   -- 한 IP 의 최근 창 탐침들

-- 기록 창구 — middleware(비로그인·로그인 둘 다) 가 부른다. 030 패턴
CREATE FUNCTION record_scan_attempt(p_ip text, p_path text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
    INSERT INTO public.scan_attempt (ip, path)
    VALUES (left(p_ip, 64), left(p_path, 256));
$$;
GRANT EXECUTE ON FUNCTION public.record_scan_attempt(text, text) TO anon, authenticated;

-- 판정 (panel) — 한 IP 가 최근 창에 '서로 다른 탐침 경로' N개 이상. login_threats 와 대칭
CREATE FUNCTION scan_threats(
    p_window interval DEFAULT interval '15 minutes',
    p_paths  int      DEFAULT 5
)
RETURNS TABLE (kind text, target text, distinct_n int, since timestamptz)
LANGUAGE sql
STABLE
SECURITY INVOKER                                       -- 🔴 호출자 권한 → scan_attempt read_admin 이 울타리
SET search_path = ''
AS $$
    SELECT '경로 스캔'::text, ip, count(DISTINCT path)::int, now() - p_window
    FROM public.scan_attempt
    WHERE at > now() - p_window AND ip IS NOT NULL AND ip <> ''
    GROUP BY ip
    HAVING count(DISTINCT path) >= p_paths
$$;

-- 알림 (실시간 claim) — check_login_alert 와 같은 구조. login_alert 재사용(kind='경로 스캔')
CREATE FUNCTION check_scan_alert(
    p_ip       text,
    p_window   interval DEFAULT interval '15 minutes',
    p_paths    int      DEFAULT 5,
    p_cooldown interval DEFAULT interval '15 minutes'
)
RETURNS TABLE (alert_kind text, alert_target text, alert_n int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_n int;
BEGIN
    IF p_ip IS NULL OR p_ip = '' THEN RETURN; END IF;   -- 미상 IP 는 판정 불가
    SELECT count(DISTINCT s.path) INTO v_n
    FROM public.scan_attempt s
    WHERE s.ip = p_ip AND s.at > now() - p_window;
    IF v_n >= p_paths THEN
        INSERT INTO public.login_alert (kind, target, last_sent_at)
        VALUES ('경로 스캔', p_ip, now())
        ON CONFLICT (kind, target) DO UPDATE SET last_sent_at = now()
        WHERE public.login_alert.last_sent_at < now() - p_cooldown;
        IF found THEN
            alert_kind := '경로 스캔'; alert_target := p_ip; alert_n := v_n; RETURN NEXT;
        END IF;
    END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.check_scan_alert(text, interval, int, interval) TO anon, authenticated;

COMMIT;
