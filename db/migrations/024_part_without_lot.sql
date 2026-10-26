-- 024_part_without_lot.sql — 어느 LOT 에도 안 든 부품 수 (10/26 · 현황판 vs 품질 차이의 정체)
--
--   현황판은 부품을 직접 센다(plant_summary). 품질은 LOT 저장 수량을 더한다(daily_yield).
--   둘의 차이 = LOT 에 안 묶인 부품. 하나로 합치면 둘 중 하나가 그 부품을 숨긴다 —
--   그래서 합치지 않고 이 숫자를 드러낸다. 0 이 아니면 LOT 을 안 열었거나 경계가 틀렸다는 신호

BEGIN;

CREATE VIEW part_without_lot WITH (security_invoker = true) AS   -- 부른 사람의 RLS (ADR 008)
SELECT count(*) AS part_count
FROM shot_part sp
WHERE NOT EXISTS (                                     -- 🔵 NOT EXISTS — 하나라도 맞는 LOT 이 있으면 뺀다 (LEFT JOIN 은 줄이 불어날 수 있다)
    SELECT 1
    FROM production_lot l
    WHERE l.equip_cd   = sp.equipment_id
      AND l.product_id = sp.product_id                 -- 🔴 빼면 패밀리 금형의 짝이 남의 LOT 에 든다 (ADR 005)
      AND sp.measured_at >= l.started_at
      AND sp.measured_at <  l.ended_at                 -- [시작, 끝) (ADR 006)
);

COMMIT;
