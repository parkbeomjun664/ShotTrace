-- 014_record_cancel.sql — 실적 취소 장부와 살아 있는 실적

BEGIN;

CREATE TABLE record_cancel (                           -- 빨간 줄만 적는 장부 — 원래 장부는 손대지 않는다 (결정 C)
    record_id    bigint PRIMARY KEY REFERENCES production_record(record_id),   -- 🔴 PK = 원래 줄 — 한 줄은 한 번만 취소 (동시에 와도 23505)
    reason       text NOT NULL CHECK (length(trim(reason)) > 0),             -- 이유는 필수 · 공백만 넣은 "   " 도 막는다
    canceled_by  uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),  -- 누가 — CASCADE 없음, 장부처럼 남는다
    canceled_at  timestamptz NOT NULL DEFAULT now()                          -- 언제
);

ALTER TABLE record_cancel ENABLE ROW LEVEL SECURITY;   -- 🔴 UPDATE · DELETE 정책 없음 — 취소를 취소할 수는 없다

CREATE POLICY "read_staff" ON record_cancel            -- 012 와 같은 모양
    FOR SELECT TO authenticated USING ((SELECT public.app_role()) IS NOT NULL);

CREATE POLICY "insert_worker" ON record_cancel         -- 장부를 쓰는 사람만 빨간 줄도 긋는다
    FOR INSERT TO authenticated
    WITH CHECK (
        (SELECT public.app_role()) IN ('worker', 'admin')
        AND canceled_by = (SELECT auth.uid())                -- 🔴 DEFAULT 는 안 보냈을 때만 — 남의 이름을 막는다
    );

CREATE VIEW active_record                              -- 살아 있는 실적 — 합계는 이걸로 낸다 (ADR 008)
WITH (security_invoker = true) AS                      -- 🔴 빠뜨리면 만든 사람 권한 → 비로그인에게도 장부가 보인다
SELECT r.*
FROM production_record r
WHERE NOT EXISTS (                                     -- 취소 장부에 없는 줄만
    SELECT 1 FROM record_cancel c WHERE c.record_id = r.record_id
);

COMMIT;
