-- 025_lot_baseline.sql — LOT 상세 차트의 기준 범위 재료 (10/26)
--
-- 왜
--   기준 범위를 그 LOT 자기 양품으로 잡으면, 이상이 섞인 LOT 은 기준도 같이 흔들린다 (자기 자신에게 채점).
--   같은 설비 · 같은 제품의 "이전" 정상 LOT 들을 기준으로 삼는다.
--
-- 규칙
--   ① 이전 정상 LOT — 같은 equip_cd · product_id · 현재 LOT 보다 먼저 시작 · 닫힌 LOT · 200샷 이상 · 불량률 5% 미만 · 현재 LOT 제외
--   ② ①이 하나도 없으면 — 같은 설비 · 제품의 전체 기간 양품 (현재 LOT 구간은 뺀다)
--   돌려주는 것: 변수마다 평균 · 표준편차 + 어느 기준을 썼나(source) · 몇 LOT 인가(lot_count)
--   ±3σ 는 화면이 계산한다 — "몇 σ" 는 보여주는 쪽의 결정

BEGIN;

CREATE FUNCTION lot_baseline(p_lot_id text)
RETURNS TABLE (
    metric     text,
    mean       double precision,
    std        double precision,
    lot_count  int,
    source     text                                    -- 'lots' (이전 정상 LOT) · 'all' (설비 전체)
)
LANGUAGE sql
STABLE
SECURITY INVOKER                                       -- 부른 사람의 RLS (ADR 008)
SET search_path = ''                                   -- 🔴 하이재킹 차단 (005 와 같다)
AS $$
  WITH cur AS (
    SELECT equip_cd, product_id, started_at, ended_at
    FROM public.production_lot
    WHERE lot_id = p_lot_id
  ),
  lots AS (                                            -- ① 이전 정상 LOT
    SELECT l.started_at, l.ended_at
    FROM public.production_lot l, cur
    WHERE l.equip_cd   = cur.equip_cd
      AND l.product_id = cur.product_id
      AND l.lot_id    <> p_lot_id                      -- 🔴 현재 LOT 은 빼고
      AND l.started_at < cur.started_at                -- 이전 것만 — 미래를 기준으로 쓰지 않는다
      AND l.ended_at  <> 'infinity'                    -- 진행 중은 아직 정상인지 모른다
      AND l.total_qty >= 200
      AND l.fail_qty < 0.05 * l.total_qty              -- 불량률 5% 미만 (나눗셈 대신 곱셈 — 0 으로 안 나눈다)
  ),
  src AS (
    SELECT CASE WHEN EXISTS (SELECT 1 FROM lots) THEN 'lots' ELSE 'all' END AS source
  ),
  good AS (                                            -- 기준이 될 양품 샷 — ① 또는 ②
    SELECT s.cycle_time, s.max_injection_pressure, s.barrel_temperature_1, s.mold_temperature_3
    FROM public.shot_part sp
    JOIN public.shot s ON s.equipment_id = sp.equipment_id AND s.measured_at = sp.measured_at
    CROSS JOIN cur
    WHERE sp.equipment_id = cur.equip_cd
      AND sp.product_id   = cur.product_id             -- 🔴 빼면 패밀리 금형의 짝까지 센다 (ADR 005)
      AND sp.pass_or_fail = 'Y'
      AND (
        ((SELECT source FROM src) = 'lots' AND EXISTS (
            SELECT 1 FROM lots
            WHERE sp.measured_at >= lots.started_at AND sp.measured_at < lots.ended_at))   -- [시작, 끝) (ADR 006)
        OR
        ((SELECT source FROM src) = 'all'
            AND NOT (sp.measured_at >= cur.started_at AND sp.measured_at < cur.ended_at))   -- 현재 LOT 구간은 뺀다
      )
  )
  SELECT v.metric,
         avg(v.val),
         stddev_samp(v.val),                           -- 표본 표준편차 — 화면(lib/evidence.ts)과 같다
         (SELECT count(*) FROM lots)::int,
         (SELECT source FROM src)
  FROM good
  CROSS JOIN LATERAL (VALUES                           -- 칸 넷을 줄 넷으로 — 변수마다 한 줄
      ('cycle_time',             good.cycle_time),
      ('max_injection_pressure', good.max_injection_pressure),
      ('barrel_temperature_1',   good.barrel_temperature_1),
      ('mold_temperature_3',     good.mold_temperature_3)
  ) AS v(metric, val)
  WHERE v.val IS NOT NULL
  GROUP BY v.metric;
$$;

COMMIT;
