-- 007_shot_part_pk.sql — shot_part 의 PK 를 자연키로 (M17 · M21)
--
-- part_id 는 원본 CSV 의 _id 다. 설비가 보내는 값이 아니라 누군가의
-- 내보내기에 붙은 행 번호라서 MQTT 메시지에 없다.
-- 부품을 식별하는 것은 (설비, 시각, 제품) 이고 이미 UNIQUE 로 있다.
--
-- part_id 는 지우지 않는다. 원본 추적용으로 nullable 로 남긴다.
-- CSV 로 들어온 5,232행은 값이 있고, MQTT 로 들어올 행은 NULL 이다.
--
--   🔴 인덱스는 잃지 않는다 — 새 PK 가 옛 UNIQUE 와 컬럼도 순서도 같다

BEGIN;

ALTER TABLE shot_part
    DROP CONSTRAINT shot_part_equipment_id_measured_at_product_id_key;

ALTER TABLE shot_part
    DROP CONSTRAINT shot_part_pkey;

ALTER TABLE shot_part
    ADD PRIMARY KEY (equipment_id, measured_at, product_id);

ALTER TABLE shot_part
    ALTER COLUMN part_id DROP NOT NULL;

COMMIT;
