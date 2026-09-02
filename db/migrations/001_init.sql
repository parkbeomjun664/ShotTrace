-- 001_init.sql — 테이블 4개
--
-- 📓 필기 M02 (①~⑦) · M03 을 펴고 시작한다.
--
-- ─────────────────────────────────────────────────────────────
-- 만들 것
-- ─────────────────────────────────────────────────────────────
--   [ ] equipment        3행     설비.  PK = equip_cd ('S14')
--   [ ] product          6행     제품.  car_model · side(LH/RH)
--   [ ] production_lot   25행    LOT.   started_at · ended_at ← 조인의 기준
--   [x] equipment_param  5,232행 샷.    PK = 원본 _id, 유효 33개 공정변수
--
-- ─────────────────────────────────────────────────────────────
-- 먼저 결정할 것 — ADR로 남긴다
-- ─────────────────────────────────────────────────────────────
--   [ ] timestamptz vs timestamp        → docs/decisions/002-타임존.md
--       CSV의 TimeStamp 에 타임존 정보가 없다. 적재 전에 정해야 하고
--       나중에 발견하면 5,232행 전체 재적재다.
--
--   [ ] 죽은 컬럼 12개을 남길지 뺄지      → docs/decisions/003-유효-컬럼.md
--       온도센서 19개 중 11개가 전 구간 0. 어느 쪽이든 근거를 남긴다.
--       면접에서 "왜 45개가 아니라 33개죠?"가 반드시 나온다.
--
-- ─────────────────────────────────────────────────────────────
-- 잊지 말 것
-- ─────────────────────────────────────────────────────────────
--   🔴 equipment_param 에 lot_id FK 를 넣지 않는다 (ADR 001)
--      equipment_id + measured_at 으로만 LOT 과 연결한다
--
--   🔴 제약조건은 문서가 아니라 DB가 강제하는 규칙이다 (M02 ⑤)
--      NOT NULL · CHECK · FK 를 아끼지 말 것
--
--   🔴 fail_reason 은 양품일 때 NULL 이어야 한다 (M02 ⑥)
--      'None' 문자열이 들어가면 COUNT(fail_reason) 을 못 쓴다
--
--   인덱스는 여기가 아니라 002_indexes.sql 에서 (M06)
--
-- ─────────────────────────────────────────────────────────────


-- 여기부터 작성


-- ── 마스터 ──────────────────────────────────────────────────

CREATE TABLE equipment (
    equip_cd    text PRIMARY KEY,                     -- PK = UNIQUE + NOT NULL
    equip_name  text NOT NULL,                        -- Postgres는 text가 기본
    tonnage     int                                   -- 이름에서 파싱 → NULL 허용
);

CREATE TABLE product (
    product_id  int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,  -- 제품명이 길어 번호로
    part_name   text NOT NULL UNIQUE,                 -- 진짜 고유값(자연키)
    car_model   text,                                 -- 파싱 → NULL 허용
    side        text CHECK (side IN ('LH', 'RH'))     -- 'lh' 'Left' 차단
);


-- ── 운영 ────────────────────────────────────────────────────

CREATE TABLE production_lot (
    lot_id      text PRIMARY KEY,                     -- 설비+계획일+제품
    equip_cd    text NOT NULL REFERENCES equipment(equip_cd),   -- FK
    product_id  int  NOT NULL REFERENCES product(product_id),   -- FK
    plan_date   date NOT NULL,                        -- 시각이 의미 없어 date

    total_qty   int NOT NULL CHECK (total_qty >= 0),
    pass_qty    int NOT NULL CHECK (pass_qty  >= 0),
    fail_qty    int NOT NULL CHECK (fail_qty  >= 0),

    started_at  timestamptz NOT NULL,                 -- UTC (ADR 002)
    ended_at    timestamptz NOT NULL,                 -- 시간구간 조인의 끝

    CHECK (pass_qty + fail_qty = total_qty),          -- 집계 버그 차단
    CHECK (ended_at > started_at)
);


CREATE TABLE equipment_param ( -- 살아있는 공정변수 24개
    param_id      text PRIMARY KEY,                   -- 원본 _id → 멱등성 (M05 ⑦)
    equipment_id  text NOT NULL REFERENCES equipment(equip_cd),
    measured_at   timestamptz NOT NULL,               -- UTC (ADR 002)
    part_serial   int,                                -- 제품 일련번호

    pass_or_fail  char(1) NOT NULL CHECK (pass_or_fail IN ('Y','N')),
    fail_reason   text,                               -- 양품이면 NULL (M02 ⑥)

    -- lot_id 는 일부러 없다. equipment_id + measured_at 으로만 잇는다 (ADR 001)

    -- 시간 (초)
    injection_time            double precision,
    filling_time              double precision,
    plasticizing_time         double precision,
    cycle_time                double precision,
    clamp_close_time          double precision,

    -- 위치 (mm)
    cushion_position          double precision,
    plasticizing_position     double precision,
    clamp_open_position       double precision,

    -- 속도
    max_injection_speed       double precision,
    max_screw_rpm             double precision,
    average_screw_rpm         double precision,

    -- 압력
    max_injection_pressure    double precision,
    max_switch_over_pressure  double precision,
    max_back_pressure         double precision,
    average_back_pressure     double precision,

    -- 온도 (도씨)
    barrel_temperature_1      double precision,
    barrel_temperature_2      double precision,
    barrel_temperature_3      double precision,
    barrel_temperature_4      double precision,
    barrel_temperature_5      double precision,
    barrel_temperature_6      double precision,
    hopper_temperature        double precision,
    mold_temperature_3        double precision,
    mold_temperature_4        double precision,

    CHECK (pass_or_fail = 'Y' OR fail_reason IS NOT NULL)   -- 불량엔 사유 필수
);


-- ── RLS ─────────────────────────────────────────────────────
-- 켜기만 하고 정책이 없으면 전부 거부된다 (M03 ⑤)
-- 쓰기 정책은 만들지 않는다 → 자동으로 막힌다 (화이트리스트)
-- ETL·수집기는 service_role 이라 RLS를 우회한다
-- USING (true) 는 임시. 로그인이 생기는 M19 에서 조인다.

ALTER TABLE equipment       ENABLE ROW LEVEL SECURITY;
ALTER TABLE product         ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_lot  ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_param ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_all" ON equipment       FOR SELECT USING (true);
CREATE POLICY "read_all" ON product         FOR SELECT USING (true);
CREATE POLICY "read_all" ON production_lot  FOR SELECT USING (true);
CREATE POLICY "read_all" ON equipment_param FOR SELECT USING (true);
