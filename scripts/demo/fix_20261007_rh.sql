-- fix_20261007_rh.sql — 10/07 시연의 RH 부품 42개에 LOT 을 만들어 준다 (일회용 · 10/26)
--
-- 왜
--   demo_lot.sql ① 이 LH LOT 하나만 열었다. S14 는 패밀리 금형이라 한 샷에 RH 도 나온다 (ADR 005).
--   RH 부품 42개가 어느 LOT 에도 안 들어가 품질 화면(LOT 저장 수량의 합)에서 빠졌다.
--   현황판(부품을 직접 셈) 5,314 vs 품질 5,271 — 차이 43 = RH 42 + LOT 열기 전날 부품 1
--
-- 무엇을
--   LH LOT 과 같은 구간으로 RH LOT 을 만들고, 그 구간의 RH 부품을 세어 수량을 채운다.
--   🔵 한 문장(INSERT … SELECT) = 한 트랜잭션 — 만들기와 세기가 따로 놀지 않는다

INSERT INTO production_lot
  (lot_id, equip_cd, product_id, plan_date,
   total_qty, pass_qty, fail_qty, started_at, ended_at)
SELECT 'S14-20261007-CN7RH', 'S14', 2, lh.plan_date,
       count(sp.measured_at),                                        -- LEFT JOIN 의 빈 줄은 안 센다
       count(sp.measured_at) FILTER (WHERE sp.pass_or_fail = 'Y'),
       count(sp.measured_at) FILTER (WHERE sp.pass_or_fail = 'N'),
       lh.started_at, lh.ended_at                                    -- 🔴 같은 샷의 짝이라 구간도 LH 와 같다
FROM production_lot lh
LEFT JOIN shot_part sp
  ON  sp.equipment_id = 'S14'
  AND sp.product_id   = 2                                            -- CN7 RH
  AND sp.measured_at >= lh.started_at
  AND sp.measured_at <  lh.ended_at                                  -- [시작, 끝) (ADR 006)
WHERE lh.lot_id = 'S14-20261007-CN7LH'
GROUP BY lh.plan_date, lh.started_at, lh.ended_at
RETURNING lot_id, total_qty, pass_qty, fail_qty, started_at, ended_at;   -- 기대: total 42 · fail 0
