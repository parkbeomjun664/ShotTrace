-- 004_views.sql — 집계를 화면에서 DB로 (M11 · ADR 008)

CREATE VIEW daily_yield WITH (security_invoker = on) AS   -- 🔴 없으면 RLS 우회
SELECT plan_date,
        SUM(total_qty) AS total_qty,
        SUM(pass_qty) AS pass_qty,
        SUM(fail_qty) AS fail_qty,
        ROUND(100.0 * SUM(pass_qty) / NULLIF(SUM(total_qty), 0), 2) AS yield_pct
FROM production_lot                                       -- 100.0 = 소수 계산 강제
GROUP BY plan_date;                                       -- 25 LOT → 13일

CREATE VIEW defect_pareto WITH (security_invoker = on) AS
SELECT fail_reason,
        COUNT(*) AS fail_qty,
        ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS share_pct
FROM shot_part                                            -- OVER () = 전체 60건
WHERE pass_or_fail = 'N'                                  -- 부분 인덱스가 여기 쓰인다
GROUP BY fail_reason;                                     -- 60건 → 3행

-- ORDER BY 는 넣지 않는다. 정렬은 조회하는 쪽이 정한다
