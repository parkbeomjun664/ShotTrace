-- 002_shot_part_split.sql — 패밀리 금형을 반영해 샷과 부품을 나눈다 (ADR 005)
--
-- 📓 필기 M02 · M03 · ADR 001·005 를 펴고 본다.
--
-- ─────────────────────────────────────────────────────────────
-- 왜 001 을 고치나
-- ─────────────────────────────────────────────────────────────
--   S14 는 한 번의 샷에서 LH · RH 두 부품을 동시에 찍는다(패밀리 금형).
--   같은 시각의 두 행에서 공정변수 24개가 전부 동일하다 — 2,626개 샷 그룹
--   전수 검사에서 값이 갈리는 컬럼이 0개였다.
--
--     공정변수(온도·압력·시간)  →  샷의 속성    한 번만 있어야 한다
--     품질(양품·불량사유)        →  부품의 속성  LH·RH 따로 있어야 한다
--
--   001 의 equipment_param 은 둘을 한 테이블에 섞어 공정변수를 두 번 저장했고,
--   그 결과 LOT 시간 구간이 설비 안에서 11번 겹쳤다. 조인이 정확히 2배를 잡는다.
--
--     equipment_param 5,232행  →  shot 2,626행  +  shot_part 5,232행
--
--   적재 전이라 옮길 데이터가 없다. 그래서 DROP 후 새로 만든다.
--
-- ─────────────────────────────────────────────────────────────
-- 잊지 말 것
-- ─────────────────────────────────────────────────────────────
--   🔴 shot 에도 lot_id 는 없다. 시간 구간 조인은 그대로다 (ADR 001)
--      바뀐 것은 조인 뒤에 shot_part 로 제품을 한 번 더 좁힌다는 점뿐이다
--
--   🔴 shot 의 PK 가 곧 시간 구간 조인 인덱스다
--      (equipment_id, measured_at) — 왼쪽 접두사 규칙 (M06)
--
--   인덱스는 여기가 아니라 003_indexes.sql 에서 (M06)
--
-- ─────────────────────────────────────────────────────────────


DROP TABLE IF EXISTS equipment_param;


-- ── 샷 — 한 번의 사출 ───────────────────────────────────────

CREATE TABLE shot (
    equipment_id  text NOT NULL REFERENCES equipment(equip_cd),
    measured_at   timestamptz NOT NULL,               -- UTC (ADR 002)

    -- 시간 (초)
    injection_time         double precision,
    filling_time           double precision,
    plasticizing_time      double precision,
    cycle_time             double precision,
    clamp_close_time       double precision,

    -- 위치 (mm)
    cushion_position       double precision,
    plasticizing_position  double precision,
    clamp_open_position    double precision,

    -- 속도
    max_injection_speed    double precision,
    max_screw_rpm          double precision,
    average_screw_rpm      double precision,

    -- 압력
    max_injection_pressure    double precision,
    max_switch_over_pressure  double precision,
    max_back_pressure         double precision,
    average_back_pressure     double precision,

    -- 온도 (℃)
    barrel_temperature_1   double precision,
    barrel_temperature_2   double precision,
    barrel_temperature_3   double precision,
    barrel_temperature_4   double precision,
    barrel_temperature_5   double precision,
    barrel_temperature_6   double precision,
    hopper_temperature     double precision,
    mold_temperature_3     double precision,
    mold_temperature_4     double precision,

    PRIMARY KEY (equipment_id, measured_at)           -- PK가 곧 시간구간 조인 인덱스
);


-- ── 부품 — 한 샷에서 나온 것 ────────────────────────────────

CREATE TABLE shot_part (
    part_id       text PRIMARY KEY,                   -- 원본 _id → 멱등성 (M05 ⑦)
    equipment_id  text NOT NULL,                      -- ┐ 복합 FK
    measured_at   timestamptz NOT NULL,               -- ┘ → shot
    product_id    int  NOT NULL REFERENCES product(product_id),
    part_serial   int,                                -- 금형 캐비티 번호로 보인다
    pass_or_fail  char(1) NOT NULL CHECK (pass_or_fail IN ('Y','N')),
    fail_reason   text,                               -- 양품이면 NULL (M02 ⑥)

    FOREIGN KEY (equipment_id, measured_at)
        REFERENCES shot(equipment_id, measured_at),   -- 부모 없는 부품 차단
    UNIQUE (equipment_id, measured_at, product_id),   -- 한 샷에 같은 제품 두 번 X
    CHECK (pass_or_fail = 'Y' OR fail_reason IS NOT NULL)   -- 불량엔 사유 필수
);


-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE shot       ENABLE ROW LEVEL SECURITY;     -- 문을 잠근다
ALTER TABLE shot_part  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_all" ON shot       FOR SELECT USING (true);
CREATE POLICY "read_all" ON shot_part  FOR SELECT USING (true);
