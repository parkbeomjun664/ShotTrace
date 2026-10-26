-- 028_master_admin_edit.sql — 마스터 2단계: 사용 중지 · 추가 · 수정 · 판정 기준 · 변경 이력 (10/26)
--
--   ① 설비 · 제품에도 사용 중지 칸 — 지우지 않는다 (ADR 015)
--   ② admin 만 추가(INSERT) · 수정(UPDATE) — 019 의 update_admin 과 같은 모양. 지우는(DELETE) 정책은 끝까지 없다
--   ③ 판정 기준 표(parameter_spec) — LOT 상세의 "최소 허용 폭" 을 코드 상수에서 표로. admin 이 화면에서 바꾼다
--   ④ 변경 이력(master_audit) — 트리거가 바꾸기 전 · 후를 통째로(jsonb) 적는다. 화면 · 사람은 이 표에 못 쓴다
--
--   🔴 이력은 트리거가 쓴다 — 화면이 쓰면 화면을 거치지 않은 변경(SQL Editor)이 빠진다

BEGIN;

-- ① 사용 중지 칸 ─────────────────────────────────────────────
ALTER TABLE equipment ADD COLUMN active boolean NOT NULL DEFAULT true;   -- 기존 줄은 모두 사용 중
ALTER TABLE product   ADD COLUMN active boolean NOT NULL DEFAULT true;

-- ② admin 만 쓴다 ─────────────────────────────────────────────
CREATE POLICY "insert_admin" ON equipment FOR INSERT TO authenticated WITH CHECK ((SELECT public.app_role()) = 'admin');
CREATE POLICY "update_admin" ON equipment FOR UPDATE TO authenticated
    USING ((SELECT public.app_role()) = 'admin') WITH CHECK ((SELECT public.app_role()) = 'admin');

CREATE POLICY "insert_admin" ON product FOR INSERT TO authenticated WITH CHECK ((SELECT public.app_role()) = 'admin');
CREATE POLICY "update_admin" ON product FOR UPDATE TO authenticated
    USING ((SELECT public.app_role()) = 'admin') WITH CHECK ((SELECT public.app_role()) = 'admin');

CREATE POLICY "insert_admin" ON downtime_reason FOR INSERT TO authenticated WITH CHECK ((SELECT public.app_role()) = 'admin');   -- UPDATE 는 019 에 있다
CREATE POLICY "insert_admin" ON defect_code     FOR INSERT TO authenticated WITH CHECK ((SELECT public.app_role()) = 'admin');

-- ③ 판정 기준 ─────────────────────────────────────────────────
CREATE TABLE parameter_spec (                          -- 기준 범위 = 평균 ± max(3σ, 최소 허용 폭) 의 "최소 허용 폭"
    metric  text PRIMARY KEY
            CHECK (metric IN ('cycle_time', 'max_injection_pressure', 'barrel_temperature_1', 'mold_temperature_3')),   -- 화면이 그리는 변수 넷 (lib/shots.ts)
    kind    text NOT NULL CHECK (kind IN ('pct', 'abs')),   -- pct = 평균의 비율 · abs = 고정 폭
    value   numeric NOT NULL CHECK (value > 0),
    unit    text NOT NULL                              -- 화면에 보여줄 단위 — '%' · 's' · 'bar' · '℃'
);

INSERT INTO parameter_spec (metric, kind, value, unit) VALUES   -- 오늘 lib/spec.ts 에 적었던 값 그대로 옮긴다
    ('cycle_time',             'pct', 0.01, '%'),      -- 평균의 1%
    ('max_injection_pressure', 'pct', 0.02, '%'),      -- 평균의 2%
    ('barrel_temperature_1',   'abs', 2,    '℃'),
    ('mold_temperature_3',     'abs', 1,    '℃');

ALTER TABLE parameter_spec ENABLE ROW LEVEL SECURITY;  -- 🔴 INSERT · DELETE 정책 없음 — 변수 넷은 고정, 값만 고친다
CREATE POLICY "read_staff" ON parameter_spec FOR SELECT TO authenticated USING ((SELECT public.app_role()) IS NOT NULL);
CREATE POLICY "update_admin" ON parameter_spec FOR UPDATE TO authenticated
    USING ((SELECT public.app_role()) = 'admin') WITH CHECK ((SELECT public.app_role()) = 'admin');

-- ④ 변경 이력 ─────────────────────────────────────────────────
CREATE TABLE master_audit (
    audit_id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    table_name  text NOT NULL,
    record_key  text NOT NULL,                         -- 그 표의 키 (equip_cd · product_id · code · reason · metric)
    action      text NOT NULL CHECK (action IN ('INSERT', 'UPDATE')),
    before      jsonb,                                 -- INSERT 면 NULL
    after       jsonb NOT NULL,
    changed_by  uuid REFERENCES auth.users(id),        -- SQL Editor 에서 바꾸면 NULL — 그래도 남는다
    changed_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX master_audit_record ON master_audit (table_name, record_key, changed_at DESC);   -- 줄마다 "이력" 을 연다

ALTER TABLE master_audit ENABLE ROW LEVEL SECURITY;    -- 🔴 쓰기 정책 없음 — 트리거(SECURITY DEFINER)만 쓴다 · 아무도 고치거나 지우지 못한다
CREATE POLICY "read_staff" ON master_audit FOR SELECT TO authenticated USING ((SELECT public.app_role()) IS NOT NULL);

CREATE FUNCTION audit_master()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER                                       -- 🔴 만든 사람 권한 — RLS 로 막아 둔 master_audit 에 쓸 수 있는 유일한 길
SET search_path = ''                                   -- 하이재킹 차단 (005)
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND to_jsonb(OLD) = to_jsonb(NEW) THEN
    RETURN NEW;                                        -- 바뀐 게 없으면 적지 않는다
  END IF;
  INSERT INTO public.master_audit (table_name, record_key, action, before, after, changed_by)
  VALUES (
    TG_TABLE_NAME,
    to_jsonb(NEW) ->> TG_ARGV[0],                      -- 키 칸 이름은 트리거마다 넘긴다
    TG_OP,
    CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) END,
    to_jsonb(NEW),
    auth.uid()                                         -- 요청한 사람 — SECURITY DEFINER 여도 요청의 JWT 를 읽는다
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER audit AFTER INSERT OR UPDATE ON equipment       FOR EACH ROW EXECUTE FUNCTION audit_master('equip_cd');
CREATE TRIGGER audit AFTER INSERT OR UPDATE ON product         FOR EACH ROW EXECUTE FUNCTION audit_master('product_id');
CREATE TRIGGER audit AFTER INSERT OR UPDATE ON downtime_reason FOR EACH ROW EXECUTE FUNCTION audit_master('code');
CREATE TRIGGER audit AFTER INSERT OR UPDATE ON defect_code     FOR EACH ROW EXECUTE FUNCTION audit_master('reason');
CREATE TRIGGER audit AFTER INSERT OR UPDATE ON parameter_spec  FOR EACH ROW EXECUTE FUNCTION audit_master('metric');

COMMIT;
