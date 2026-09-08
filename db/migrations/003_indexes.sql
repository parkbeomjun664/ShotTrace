-- 003_indexes.sql — 조회 인덱스 3개 (M06 ★ · ADR 007)

CREATE INDEX idx_shot_part_lot_lookup                      -- LOT 상세 시간구간 조인 ★
    ON shot_part (equipment_id, product_id, measured_at);  -- 🔴 등호 먼저, 범위 나중

CREATE INDEX idx_production_lot_started_at                 -- LOT 목록 정렬
    ON production_lot (started_at DESC);                   -- 25행이라 안 쓸 수도 있다

CREATE INDEX idx_shot_part_defect                          -- 불량 파레토 (W04)
    ON shot_part (fail_reason)
    WHERE pass_or_fail = 'N';                              -- 부분 인덱스 · 60/5232

-- FK 인덱스는 일부러 안 걸었다 — 쓰는 쿼리가 없다 (ADR 007)
