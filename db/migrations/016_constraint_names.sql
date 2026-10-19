-- 016_constraint_names.sql — 이름 없는 제약에 이름을 붙인다 (M22)
-- 🔵 에러 메시지에 찍히는 건 제약 이름이다. 이름이 없으면 Postgres 가 테이블_check, _check1 로 번호를 매긴다

BEGIN;

ALTER TABLE production_lot RENAME CONSTRAINT production_lot_check  TO lot_qty_sum;       -- 양품 + 불량 = 생산 (001)
ALTER TABLE production_lot RENAME CONSTRAINT production_lot_check1 TO lot_time_order;    -- 끝 > 시작 (001)
ALTER TABLE production_record RENAME CONSTRAINT production_record_check TO record_qty_positive;   -- 0 + 0 금지 (012)
ALTER TABLE shot_part RENAME CONSTRAINT shot_part_check TO part_fail_has_reason;        -- 불량이면 사유 필수 (002)

COMMIT;                                                -- 이름표만 바꾼다 — 규칙 · 데이터 · 배포본 영향 없음
