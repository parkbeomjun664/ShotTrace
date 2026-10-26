-- 026_unrecorded_stop.sql — 사유 미입력 정지 (10/26 · 비가동 화면)
--
-- 왜
--   ADR 016 은 샷 간격으로 정지를 "추정해서" 가동률에 넣는 것을 버렸다 — 사유가 없고 기준이 없다.
--   여기서는 추정하지 않는다. 샷 간격으로 "찾아서 보여주고", 사람이 사유를 고르는 순간 비가동 기록이 된다.
--   기록이 되면 OEE View(021)가 시간 구간 조인으로 알아서 가동률에 넣는다.
--
-- 규칙
--   ① LOT 구간 안의 빈 곳만 — LOT 사이(밤 · 주말)는 계획된 생산 시간이 아니다
--   ② 두 샷 사이가 표준 CT × 5 를 넘으면 (화면 lib/shots.ts 의 GAP_FACTOR 와 같다)
--   ③ 정지 = [앞 샷 + 표준 CT, 뒤 샷) — 앞 샷의 사이클이 끝난 뒤부터 멈춘 것이다
--   ④ 패밀리 금형 — LH · RH 두 LOT 이 같은 빈 곳을 낸다. 설비 · 시작이 같으면 하나로
--   ⑤ 이미 기록된 비가동과 겹치면 뺀다

BEGIN;

ALTER TABLE downtime
    ADD COLUMN source text NOT NULL DEFAULT 'manual',  -- 어떻게 생긴 기록인가 — 직접 입력 · 빈 곳에 사유를 고른 것
    ADD CONSTRAINT downtime_source CHECK (source IN ('manual', 'inferred'));   -- 처음부터 이름을 붙인다 (016 의 교훈)

CREATE VIEW unrecorded_stop WITH (security_invoker = true) AS   -- 부른 사람의 RLS (ADR 008)
WITH parts AS (
    SELECT l.lot_id, l.equip_cd, p.std_cycle_sec, sp.measured_at,
           lag(sp.measured_at) OVER (PARTITION BY l.lot_id ORDER BY sp.measured_at) AS prev   -- 바로 앞 샷
    FROM production_lot l
    JOIN product p ON p.product_id = l.product_id
    JOIN shot_part sp
      ON sp.equipment_id = l.equip_cd
     AND sp.product_id   = l.product_id
     AND sp.measured_at >= l.started_at
     AND sp.measured_at <  l.ended_at                  -- ① LOT 안 · [시작, 끝) (ADR 006)
    WHERE p.std_cycle_sec IS NOT NULL
),
gaps AS (
    SELECT DISTINCT ON (equip_cd, prev)                -- ④ LH · RH 중복을 하나로 (먼저 오는 LOT 번호)
           equip_cd, lot_id,
           prev + make_interval(secs => std_cycle_sec) AS started_at,   -- ③
           measured_at AS ended_at
    FROM parts
    WHERE prev IS NOT NULL
      AND measured_at - prev > make_interval(secs => std_cycle_sec * 5)   -- ② 딱 5배는 아직 정상
    ORDER BY equip_cd, prev, lot_id
)
SELECT g.equip_cd, g.lot_id, g.started_at, g.ended_at,
       round(extract(epoch FROM g.ended_at - g.started_at) / 60)::int AS minutes
FROM gaps g
WHERE NOT EXISTS (                                     -- ⑤ 이미 기록된 비가동과 겹치면 뺀다
    SELECT 1 FROM downtime d
    WHERE d.equip_cd = g.equip_cd
      AND tstzrange(d.started_at, d.ended_at) && tstzrange(g.started_at, g.ended_at)
);

COMMIT;
