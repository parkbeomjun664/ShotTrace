-- 021_oee_input.sql — OEE 의 입력: 표준 사이클타임과 LOT 별 재료 (M24 · ADR 016)

BEGIN;

ALTER TABLE product                                    -- ① 만들기 · ② 채우기 — ③ 묶기(NOT NULL)는 일부러 안 한다
    ADD COLUMN std_cycle_sec numeric,                  -- 표준 사이클타임(초) — 약속된 값 · 없으면 OEE 는 null
    ADD CONSTRAINT product_std_cycle_positive CHECK (std_cycle_sec > 0);   -- 0 · 음수면 성능이 0 · 음수

UPDATE product p                                       -- 임시 표준 = 실측 중앙값 (라우팅이 없어서 · ADR 016)
SET std_cycle_sec = m.median_sec
FROM (
    SELECT sp.product_id,
           round(percentile_cont(0.5) WITHIN GROUP (ORDER BY s.cycle_time)::numeric, 2) AS median_sec   -- 중앙값 — 튀는 값(교체 직후)에 덜 흔들린다
    FROM shot_part sp
    JOIN shot s ON s.equipment_id = sp.equipment_id AND s.measured_at = sp.measured_at
    GROUP BY sp.product_id
) m
WHERE p.product_id = m.product_id;                     -- 🔴 WHERE 가 생명 — 빼면 모든 제품에 같은 값

CREATE VIEW lot_oee_input                              -- LOT 별 OEE 재료 — 계산은 순수함수(lib/oee.ts)가 한다
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
       extract(epoch FROM upper(lot.span) - lower(lot.span)) / 60 AS load_minutes,
       coalesce(stop.planned_minutes, 0) AS planned_minutes,
       coalesce(stop.loss_minutes, 0) AS loss_minutes,
       coalesce(work.shots, 0) AS shots,
       coalesce(work.good_qty, 0) AS good_qty
FROM lot
LEFT JOIN stop ON stop.lot_id = lot.lot_id             -- 비가동 없는 LOT 도 빠지지 않게 — coalesce 로 0
LEFT JOIN work ON work.lot_id = lot.lot_id;

COMMIT;
