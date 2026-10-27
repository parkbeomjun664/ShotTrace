-- 011_roles.sql — 앱 역할과 역할 기반 읽기 (ADR 008)
-- 🔴 코드(queries.ts · client.ts)를 먼저 옮긴 뒤에 실행한다. 옛 코드는 anon 이라 빈 화면이 된다

BEGIN;

CREATE TABLE user_role (                               -- 놀이기구 앞 명단 — 바꾸면 즉시 반영
    user_id  uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,   -- 사용자를 지우면 같이
    role     text NOT NULL CHECK (role IN ('viewer', 'worker', 'admin'))     -- 오타 역할을 막는다
);

CREATE FUNCTION app_role()                             -- "내 역할" 을 돌려주는 좁은 창구
RETURNS text
LANGUAGE sql
STABLE                                                 -- 한 쿼리 안에서는 같은 값
SECURITY DEFINER                                       -- 🔴 만든 사람 권한 → RLS 를 건너뛰어 재귀를 끊는다
SET search_path = ''                                   -- 🔴 하이재킹 차단 · 그래서 public. 을 다 붙인다
AS $$
    SELECT role FROM public.user_role WHERE user_id = auth.uid();   -- 🔴 나 하나로 고정 · 인자를 안 받는다
$$;

ALTER TABLE user_role ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_own_or_admin" ON user_role         -- 🔴 쓰기 정책은 없다 — 화면에서 역할을 못 바꾼다
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR (SELECT public.app_role()) = 'admin');   -- 명단이 명단을 읽는 자리

DROP POLICY "read_all" ON equipment;                   -- USING (true) — 9월에 달아둔 활짝 열린 문
DROP POLICY "read_all" ON product;
DROP POLICY "read_all" ON production_lot;
DROP POLICY "read_all" ON shot;
DROP POLICY "read_all" ON shot_part;                   -- equipment_param 은 002 에서 지운 테이블

-- 로그인했고 명단에 있어야 읽는다. anon 은 정책이 없으니 0 rows (에러 없음)
-- 🔵 (SELECT …) 로 감싸면 행마다가 아니라 쿼리마다 한 번만 부른다
CREATE POLICY "read_staff" ON equipment
    FOR SELECT TO authenticated USING ((SELECT public.app_role()) IS NOT NULL);
CREATE POLICY "read_staff" ON product
    FOR SELECT TO authenticated USING ((SELECT public.app_role()) IS NOT NULL);
CREATE POLICY "read_staff" ON production_lot
    FOR SELECT TO authenticated USING ((SELECT public.app_role()) IS NOT NULL);
CREATE POLICY "read_staff" ON shot
    FOR SELECT TO authenticated USING ((SELECT public.app_role()) IS NOT NULL);
CREATE POLICY "read_staff" ON shot_part                -- 🔴 Realtime 알림도 이 정책을 따른다 (ADR 012)
    FOR SELECT TO authenticated USING ((SELECT public.app_role()) IS NOT NULL);

COMMIT;
