-- 019_master_admin.sql — 마스터는 admin 만 고친다 · 지우지 않고 사용 중지

BEGIN;

CREATE POLICY "update_admin" ON downtime_reason          -- 첫 UPDATE 정책 — 장부(트랜잭션)에는 없고 메뉴판(마스터)에만
    FOR UPDATE TO authenticated
    USING ((SELECT public.app_role()) = 'admin')            -- 꺼낼 때 — 고칠 대상을 admin 만 고른다
    WITH CHECK ((SELECT public.app_role()) = 'admin');      -- 들일 때 — 고친 결과도 admin 만 · 🔴 막히면 조용히 0행

CREATE POLICY "update_admin" ON defect_code
    FOR UPDATE TO authenticated
    USING ((SELECT public.app_role()) = 'admin')
    WITH CHECK ((SELECT public.app_role()) = 'admin');

COMMIT;                                                  -- 🔴 DELETE 정책은 없다 — 사용 중지(active)로 · 가리키는 기록이 있으면 FK 도 막는다
