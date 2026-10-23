-- 022_oee_load_cycle.sql — 부하 시간에 마지막 샷의 한 사이클을 더한다 (M24 · ADR 006 의 꼬리)
-- LOT 끝 = 마지막 샷 + 1초 (ADR 006) 는 조인용 경계라 맞다. 그런데 일한 시간으로 보면 마지막 샷의 사이클이 빠져
-- 짧은 LOT 일수록 성능이 부푼다 (샷 1개 LOT = 구간 1초 → 자르기 전 6,686%). 경계는 그대로 두고 OEE 재료에서만 더한다.

BEGIN;

CREATE OR REPLACE VIEW lot_oee_input                   -- 🔵 덮어쓴다 — 칸의 이름 · 순서 · 타입이 같아야 통한다 (010)
WITH (security_invoker = true) AS                      -- 부른 사람의 RLS (ADR 008)
WITH lot AS (                                          -- ① LOT 구간 — 진행 중(infinity)은 지금까지
    SELECT l.lot_id, l.equip_cd, l.product_id, p.std_cycle_sec,
           tstzrange(l.started_at, LEAST(l.ended_at, now())) AS span
    FROM production_lot l
    JOIN product p ON p.product_id = l.product_id
),
stop AS (                                              -- ② LOT 과 겹친 비가동 — 계획 정지와 손실로 나눈다
    SELECT lot.lot_id,
           sum(extract(epoch FROM upper(lot.span * d.span) - lower(lot.span * d.span)) / 60)   -- 🔵 * = 겹친 부분만 (LOT 밖은 이 LOT 의 손실이 아니다)
               FILTER (WHERE r.planned) AS planned_minutes,   -- 🔵 FILTER = 같은 sum 을 조건별로
           sum(extract(epoch FROM upper(lot.span * d.span) - lower(lot.span * d.span)) / 60)
               FILTER (WHERE NOT r.planned) AS loss_minutes   -- 셋업(020) + 계획 외 정지
    FROM lot
    JOIN (SELECT equip_cd, reason_code, tstzrange(started_at, ended_at) AS span FROM downtime) d
      ON d.equip_cd = lot.equip_cd AND d.span && lot.span
    JOIN downtime_reason r ON r.code = d.reason_code
    GROUP BY lot.lot_id
),
work AS (                                              -- ③ LOT 안의 샷 · 양품 — 시간 구간 조인 (ADR 001)
    SELECT lot.lot_id,
           count(*) AS shots,                         -- LOT 은 제품 하나 → 그 제품 부품 수 = 샷 수 (패밀리 금형이어도 두 배가 안 된다)
           count(*) FILTER (WHERE sp.pass_or_fail = 'Y') AS good_qty
    FROM lot
    JOIN shot_part sp
      ON sp.equipment_id = lot.equip_cd
     AND sp.product_id = lot.product_id
     AND sp.measured_at >= lower(lot.span)              -- 🔴 span @> 대신 풀어 쓴다 — 인덱스를 탄다 (ADR 007) · [시작, 끝)
     AND sp.measured_at < upper(lot.span)
    GROUP BY lot.lot_id
)
SELECT lot.lot_id,
       lot.equip_cd,
       lot.product_id,
       lot.std_cycle_sec,
       extract(epoch FROM upper(lot.span) - lower(lot.span)) / 60 + coalesce(lot.std_cycle_sec, 0) / 60 AS load_minutes,   -- 🔴 + 마지막 샷의 한 사이클 — 바뀐 곳은 이 줄뿐
       coalesce(stop.planned_minutes, 0) AS planned_minutes,
       coalesce(stop.loss_minutes, 0) AS loss_minutes,
       coalesce(work.shots, 0) AS shots,
       coalesce(work.good_qty, 0) AS good_qty
FROM lot
LEFT JOIN stop ON stop.lot_id = lot.lot_id             -- 비가동 없는 LOT 도 빠지지 않게 — coalesce 로 0
LEFT JOIN work ON work.lot_id = lot.lot_id;

COMMIT;
