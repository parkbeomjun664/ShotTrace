-- 005_rpc.sql — 시간 구간 조인을 DB 함수로 (M11 · ADR 001·005·006)

CREATE FUNCTION get_lot_shots(p_lot_id text)               -- p_ = 컬럼명과 구분
RETURNS TABLE (                                            -- 반환 모양 선언
  part_id                text,
  measured_at            timestamptz,
  part_serial            int,
  pass_or_fail           char(1),
  fail_reason            text,
  cycle_time             double precision,
  injection_time         double precision,
  max_injection_pressure double precision,
  max_back_pressure      double precision,
  cushion_position       double precision,
  barrel_temperature_1   double precision,
  barrel_temperature_6   double precision,
  mold_temperature_3     double precision
)                                                          -- 13개 = 아래 SELECT 13개
LANGUAGE sql                                               -- SELECT 하나뿐
STABLE                                                     -- 읽기만 — 옵티마이저 힌트
SECURITY INVOKER                                           -- 부른 사람 권한 = RLS 적용
SET search_path = ''                                       -- 🔴 하이재킹 차단
AS $$
  SELECT sp.part_id,
         sp.measured_at,
         sp.part_serial,
         sp.pass_or_fail,
         sp.fail_reason,
         s.cycle_time,
         s.injection_time,
         s.max_injection_pressure,
         s.max_back_pressure,
         s.cushion_position,
         s.barrel_temperature_1,
         s.barrel_temperature_6,
         s.mold_temperature_3
  FROM   public.production_lot l                          -- public. 필수 (search_path 비움)
  JOIN   public.shot_part sp
    ON   sp.equipment_id = l.equip_cd
   AND   sp.product_id   = l.product_id                   -- 🔴 빼면 2배 (ADR 005)
   AND   sp.measured_at >= l.started_at
   AND   sp.measured_at <  l.ended_at                     -- 반열린 구간 (ADR 006)
  JOIN   public.shot s
    ON   s.equipment_id = sp.equipment_id
   AND   s.measured_at  = sp.measured_at
  WHERE  l.lot_id = p_lot_id
  ORDER  BY sp.measured_at;                                -- 함수는 완결된 답을 준다
$$;
