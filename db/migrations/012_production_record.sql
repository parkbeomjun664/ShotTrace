-- 012_production_record.sql — 실적 기록과 역할 기반 쓰기 (M19)

BEGIN;

CREATE TABLE production_record (                       -- 볼펜 장부 — 고치지 않고 취소 후 재등록
    record_id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,           -- 번호는 DB 가 매긴다
    lot_id       text NOT NULL REFERENCES production_lot(lot_id),           -- 어느 LOT 의 실적인가
    pass_qty     int  NOT NULL CHECK (pass_qty >= 0),
    fail_qty     int  NOT NULL CHECK (fail_qty >= 0),
    recorded_by  uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id), -- 🔴 CASCADE 없음 — 사람이 떠나도 장부는 남는다
    recorded_at  timestamptz NOT NULL DEFAULT now(),                        -- updated_at 은 없다 — 고칠 일이 없으니까
    CHECK (pass_qty + fail_qty > 0)                    -- 0 + 0 은 빈 줄이다
);

ALTER TABLE production_record ENABLE ROW LEVEL SECURITY;    -- 🔴 UPDATE · DELETE 정책은 없다 = 수정 불가 · 지우개 없음

CREATE POLICY "read_staff" ON production_record        -- 꺼낼 때 검사 — 걸리면 조용히 0 rows
    FOR SELECT TO authenticated USING ((SELECT public.app_role()) IS NOT NULL);

CREATE POLICY "insert_worker" ON production_record     -- 들일 때 검사 — 🔴 걸리면 진짜 에러
    FOR INSERT TO authenticated
    WITH CHECK (
        (SELECT public.app_role()) IN ('worker', 'admin')   -- viewer 는 여기서 막힌다
        AND recorded_by = (SELECT auth.uid())                -- 🔴 DEFAULT 는 안 보냈을 때만 — 남의 이름을 막는다
    );

COMMIT;
