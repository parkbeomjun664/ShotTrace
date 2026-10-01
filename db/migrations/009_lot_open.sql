-- 009_lot_open.sql — 진행 중 LOT 과 구간 겹침 방지 (M17 · M21 · ADR 006)
--
-- 진행 중 LOT 은 ended_at = 'infinity' 다. NULL 이 아니다.
--   NULL 이면 조인마다 OR ended_at IS NULL 이 붙고, 한 군데만 빼먹어도
--   진행 중 LOT 이 조용히 사라진다. 무한대는 비교가 그냥 된다.
--
-- 🔴 열린 구간은 미래를 전부 삼킨다. 겹침을 DB 가 막아야 한다.
--   S14-20201016-CN7LH 를 열어두면 187개가 1,985개가 된다 (10.6배).
--
-- 기존 25개 LOT 에 겹치는 쌍이 0개임을 확인하고 건다.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE production_lot
    ADD CONSTRAINT lot_no_overlap
    EXCLUDE USING gist (
        equip_cd                        WITH =,
        product_id                      WITH =,
        tstzrange(started_at, ended_at) WITH &&
    );
