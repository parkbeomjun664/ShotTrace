-- 006_summary_views.sql — 현황판 집계를 DB로 (M11 · ADR 008)

CREATE VIEW equipment_summary WITH (security_invoker = on) AS
SELECT e.equip_cd
        , e.equip_name
        , e.tonnage
        , COUNT(l.lot_id) AS lot_count               -- 🔴 COUNT(*) 면 실적 0인 설비가 1
        , COALESCE(SUM(l.total_qty), 0) AS total_qty -- LEFT JOIN 이면 SUM 이 NULL
        , COALESCE(SUM(l.pass_qty), 0) AS pass_qty
        , COALESCE(SUM(l.fail_qty), 0) AS fail_qty
        , ROUND(100.0 * SUM(l.pass_qty) / NULLIF(SUM(l.total_qty), 0), 2) AS yield_pct
FROM equipment e                                     -- 🔵 마스터가 왼쪽 = 기준
LEFT JOIN production_lot l ON l.equip_cd = e.equip_cd -- 실적 없는 설비도 남는다
GROUP BY e.equip_cd, e.equip_name, e.tonnage;        -- SELECT 의 e.* 를 전부

CREATE VIEW plant_summary WITH (security_invoker = on) AS
SELECT COUNT(*) AS lot_count,                        -- 여기는 NULL 행이 없어 COUNT(*) 가 맞다
        SUM(total_qty) AS total_qty,
        SUM(pass_qty) AS pass_qty,
        SUM(fail_qty) AS fail_qty,
        ROUND(100.0 * SUM(pass_qty) / NULLIF(SUM(total_qty), 0), 2) AS yield_pct
FROM production_lot;