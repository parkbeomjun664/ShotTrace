-- 010_live_summary.sql — 현황판 집계를 샷 기준으로 (M18 · ADR 008)
--
-- 수집기는 shot_part 에 쓰는데 현황판은 production_lot 의 저장 컬럼을 읽고 있었다.
-- 새 샷이 들어와도 숫자가 안 변했다. 실시간의 전제조건이라 먼저 고친다.
--
-- 🔴 컬럼 이름·개수·순서는 006 과 똑같이 둔다 — 화면 코드를 한 줄도 안 고치려고.
--    View 는 화면과 테이블 사이의 계약이다. 계약을 지키면 안쪽은 바꿔도 된다.

BEGIN;                                              -- View 둘을 한 묶음으로. 하나만 바뀌면 화면이 어긋난다

DROP VIEW equipment_summary;                        -- 🔴 CREATE OR REPLACE 는 컬럼 구성이 같아야만 통한다
DROP VIEW plant_summary;                            -- 의존하는 View 가 없다 — 읽는 건 화면뿐

CREATE VIEW equipment_summary WITH (security_invoker = on) AS   -- 🔴 빼면 RLS 우회 (ADR 008)
WITH part_agg AS (                                  -- 🔵 조인 전에 "설비당 1행" 으로 접는다
    SELECT equipment_id
            -- FILTER = 이 집계 하나만 조건을 본다. WHERE 로 쓰면 세 숫자가 다 걸러진다
            , COUNT(*) AS total_qty                 -- 부품 1행 = 생산 1개
            , COUNT(*) FILTER (WHERE pass_or_fail = 'Y') AS pass_qty
            , COUNT(*) FILTER (WHERE pass_or_fail = 'N') AS fail_qty
    FROM shot_part                                  -- 🔵 바뀐 곳. 저장된 집계 대신 원본을 센다
    GROUP BY equipment_id
), lot_agg AS (                                     -- WITH 는 한 번. 둘째부터는 쉼표
    SELECT equip_cd
            , COUNT(*) AS lot_count                 -- LOT 개수는 LOT 테이블이 진실
    FROM production_lot                             -- 샷이 들어와도 안 변하는 숫자라 여기 그대로
    GROUP BY equip_cd
)
SELECT e.equip_cd                                   -- 🔴 두 집계를 한꺼번에 조인하면 행이 곱해진다
        , e.equip_name                              --    (fan-out) 1행끼리 붙이니 곱해질 게 없다
        , e.tonnage
        , COALESCE(l.lot_count, 0) AS lot_count     -- 집계 자체는 NULL 을 안 내지만
        , COALESCE(p.total_qty, 0) AS total_qty     -- LEFT JOIN 이 짝 없는 쪽을 NULL 로 만든다
        , COALESCE(p.pass_qty, 0) AS pass_qty
        , COALESCE(p.fail_qty, 0) AS fail_qty
        -- 🔴 여기만 COALESCE 를 안 쓴다. 실적 없는 설비의 수율은 0% 가 아니라 "없음" 이다
        , ROUND(100.0 * p.pass_qty / NULLIF(p.total_qty, 0), 2) AS yield_pct
FROM equipment e                                    -- 🔵 마스터가 왼쪽 = 기준 (006 과 같다)
LEFT JOIN part_agg p ON p.equipment_id = e.equip_cd   -- 🔴 이름이 다르다 equipment_id ↔ equip_cd
LEFT JOIN lot_agg l ON l.equip_cd = e.equip_cd;     -- 실적 없는 설비도 3행에 남는다

CREATE VIEW plant_summary WITH (security_invoker = on) AS   -- 🔴 여기도 빠뜨리면 RLS 우회
SELECT (SELECT COUNT(*) FROM production_lot) AS lot_count   -- 컬럼 자리에 앉은 쿼리(스칼라 서브쿼리)
        , COUNT(*) AS total_qty                     -- GROUP BY 가 없다 = 전체를 한 덩어리로
        , COUNT(*) FILTER (WHERE pass_or_fail = 'Y') AS pass_qty
        , COUNT(*) FILTER (WHERE pass_or_fail = 'N') AS fail_qty
        -- 🔴 pass_qty 를 다시 못 쓴다. SELECT 목록은 서로의 결과를 모른다
        , ROUND(100.0 * COUNT(*) FILTER (WHERE pass_or_fail = 'Y')
                / NULLIF(COUNT(*), 0), 2) AS yield_pct
FROM shot_part;                                     -- 🔵 집계 1행은 비어 있어도 나온다 → maybeSingle 유지

-- 🔵 Realtime 은 WAL(변경 일지)을 읽는다. 발행 명단에 없는 테이블은 일지에서 걸러진다.
--    🔴 이 줄이 없으면 구독은 SUBSCRIBED 가 되고 알림만 영원히 안 온다. 에러는 없다
ALTER PUBLICATION supabase_realtime ADD TABLE shot_part;   -- shot 은 LOT 상세 할 때(화) 추가

COMMIT;                                             -- 🔴 여기까지 와야 한 건이라도 반영된다
