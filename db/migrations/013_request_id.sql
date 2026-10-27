-- 013_request_id.sql — 같은 제출은 장부에 한 줄만 (멱등)

BEGIN;

ALTER TABLE production_record                          -- 🔴 NOT NULL 칸 추가는 기존 행이 있으면 실패 — 장부 0줄일 때 건다
    ADD COLUMN request_id uuid NOT NULL UNIQUE;        -- 송장번호 — 같은 번호는 두 번 못 들어온다 (23505) · DEFAULT 는 일부러 없음

COMMIT;
