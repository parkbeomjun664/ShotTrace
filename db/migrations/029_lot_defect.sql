-- 029_lot_defect.sql — LOT 별 · 불량 유형별 건수 (10/27 · 파레토 → LOT 목록)
--
-- 왜
--   품질 파레토는 "가스 36건" 까지만 말한다. 그 36건이 어느 LOT 에서 났는지 이으려면 LOT 마다 유형별로 세야 한다.
--   production_lot 의 fail_qty 는 유형을 모른다 → shot_part 를 LOT 의 시간 구간으로 잇는다 (ADR 001 · 그 조인 그대로)
--
-- 규칙
--   설비 · 제품이 같고 [시작, 끝) 안 (ADR 006) · 제품까지 맞춰야 패밀리 금형의 짝이 남의 LOT 에 안 든다 (ADR 005)
--   불량만 (pass_or_fail = 'N' — 부분 인덱스가 쓰인다 · 007)

BEGIN;

CREATE VIEW lot_defect WITH (security_invoker = true) AS   -- 부른 사람의 RLS (ADR 008)
SELECT l.lot_id,
       sp.fail_reason,
       count(*) AS fail_qty
FROM production_lot l
JOIN shot_part sp
  ON sp.equipment_id = l.equip_cd
 AND sp.product_id   = l.product_id
 AND sp.measured_at >= l.started_at
 AND sp.measured_at <  l.ended_at
WHERE sp.pass_or_fail = 'N'
GROUP BY l.lot_id, sp.fail_reason;
-- ORDER BY 는 넣지 않는다. 정렬은 조회하는 쪽이 정한다 (004 와 같다)

COMMIT;
