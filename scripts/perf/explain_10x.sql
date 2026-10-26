-- explain_10x.sql — 10배 데이터에서 인덱스가 버티나 (M27 · 9월 evidence/003 의 다시 재기)
-- 덩어리 하나씩 SQL Editor 에 붙여 Run 한다 (Editor 는 마지막 결과만 보여준다)


-- ① LOT 하나의 부품 — 인덱스를 쓰는 평소 길 ──────────────────────────
EXPLAIN ANALYZE
SELECT sp.pass_or_fail, sp.fail_reason
FROM perf.production_lot l
JOIN perf.shot_part sp
  ON sp.equipment_id = l.equip_cd
 AND sp.product_id = l.product_id
 AND sp.measured_at >= l.started_at
 AND sp.measured_at < l.ended_at
WHERE l.lot_id = 'S14-20201103-CN7LH-5';


-- ② 같은 쿼리 — 인덱스를 못 쓰게 하면 ─────────────────────────────────
SET enable_indexscan = off;
SET enable_bitmapscan = off;
EXPLAIN ANALYZE
SELECT sp.pass_or_fail, sp.fail_reason
FROM perf.production_lot l
JOIN perf.shot_part sp
  ON sp.equipment_id = l.equip_cd
 AND sp.product_id = l.product_id
 AND sp.measured_at >= l.started_at
 AND sp.measured_at < l.ended_at
WHERE l.lot_id = 'S14-20201103-CN7LH-5';


-- ③ 원래대로 (🔴 꼭) ────────────────────────────────────────────────────
RESET ALL;


-- ④ 모든 LOT 의 샷 수 — OEE 재료(lot_oee_input) 의 가장 무거운 부분 · 10배 ─────
EXPLAIN ANALYZE
SELECT l.lot_id, count(*) AS shots
FROM perf.production_lot l
JOIN perf.shot_part sp
  ON sp.equipment_id = l.equip_cd
 AND sp.product_id = l.product_id
 AND sp.measured_at >= l.started_at
 AND sp.measured_at < l.ended_at
GROUP BY l.lot_id;


-- ⑤ 같은 것을 원본(public · 1배)에서 — 10배가 시간도 10배인가 ──────────────
EXPLAIN ANALYZE
SELECT l.lot_id, count(*) AS shots
FROM public.production_lot l
JOIN public.shot_part sp
  ON sp.equipment_id = l.equip_cd
 AND sp.product_id = l.product_id
 AND sp.measured_at >= l.started_at
 AND sp.measured_at < l.ended_at
GROUP BY l.lot_id;
