-- demo_lot.sql — 데모용 LOT 을 열고 · 닫고 · 치운다 (M18)
--
-- 왜 필요한가
--   replay.py 는 원본 measured_at 을 그대로 보낸다. 이미 있는 행을 때리므로
--   upsert 가 UPDATE 가 되고 숫자가 안 움직인다. 그래서 데모는 --live 로 돌린다.
--
--     python services/simulator/replay.py --live --limit 30
--
--   --live 는 "지금부터 1배속" 이라 새 행이 생긴다. 그 샷을 받을 LOT 이 ①이다.
--
-- 🔴 구분 기준은 "2026년 이후" 다. 원본 데이터는 2020-10 ~ 11 뿐이다.


-- ───────────────────────────────────────────────────────────
-- ① 열기 — 재생을 시작하기 전에
-- ───────────────────────────────────────────────────────────
--   🔴 started_at 이 첫 샷보다 앞서야 샷이 이 LOT 안으로 들어간다.
--   🔵 ended_at = 'infinity' 가 "진행 중" 이다 (ADR 010). NULL 이 아니다.
--   🔵 EXCLUDE 제약이 같은 설비·제품의 구간 겹침을 막는다 (009). 통과하면
--      "열려 있는 LOT 이 또 있지는 않다" 는 뜻이기도 하다.

INSERT INTO production_lot
  (lot_id, equip_cd, product_id, plan_date,
   total_qty, pass_qty, fail_qty, started_at, ended_at)
VALUES
  ('S14-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-CN7LH',
   'S14', 1, CURRENT_DATE,
   0, 0, 0, now(), 'infinity');          -- 수량 0 — 아직 아무것도 안 만들었다


-- ───────────────────────────────────────────────────────────
-- ② 닫기 — 재생이 끝나면
-- ───────────────────────────────────────────────────────────
--   🔴 끝난 LOT 을 "진행 중" 으로 두지 않는다. 조용히 틀린 값을 DB 에 남기는 일이다
--      (10/1 에 같은 이유로 열어둔 LOT 을 닫았다).
--   🔴 저장 수량도 같이 채운다. 0 으로 두면 LOT 목록 화면이 0 개로 보인다.

UPDATE production_lot l
SET ended_at  = now(),
    total_qty = (SELECT count(*) FROM shot_part sp               -- 상관 서브쿼리 —
                 WHERE sp.equipment_id = l.equip_cd              -- 바깥 행(l)을 보고 센다
                   AND sp.product_id   = l.product_id
                   AND sp.measured_at >= l.started_at),
    pass_qty  = (SELECT count(*) FROM shot_part sp
                 WHERE sp.equipment_id = l.equip_cd
                   AND sp.product_id   = l.product_id
                   AND sp.measured_at >= l.started_at
                   AND sp.pass_or_fail = 'Y'),
    fail_qty  = (SELECT count(*) FROM shot_part sp
                 WHERE sp.equipment_id = l.equip_cd
                   AND sp.product_id   = l.product_id
                   AND sp.measured_at >= l.started_at
                   AND sp.pass_or_fail = 'N')
WHERE l.ended_at = 'infinity'                                    -- 열려 있는 것만
  AND l.plan_date >= DATE '2026-01-01';                          -- 🔴 데모만 — 원본은 2020년


-- ───────────────────────────────────────────────────────────
-- ③ 치우기 — 데모 데이터를 전부 지운다
-- ───────────────────────────────────────────────────────────
--   🔴 순서가 중요하다. shot_part 가 shot 을 FK 로 참조한다 (002).
--      부모를 먼저 지우려 하면 제약이 막는다.

DELETE FROM shot_part     WHERE measured_at >= TIMESTAMPTZ '2026-01-01';
DELETE FROM shot          WHERE measured_at >= TIMESTAMPTZ '2026-01-01';
DELETE FROM production_lot WHERE plan_date  >= DATE        '2026-01-01';
