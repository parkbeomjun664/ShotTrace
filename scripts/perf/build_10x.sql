-- build_10x.sql — 성능 실험용 10배 데이터 · 화면과 안 섞이게 perf 스키마에 · 치우기: DROP SCHEMA perf CASCADE;

BEGIN;

DROP SCHEMA IF EXISTS perf CASCADE;                    -- perf 폴더만 — 몇 번을 돌려도 같은 결과 (멱등) · public 은 안 건드린다
CREATE SCHEMA perf;                                    -- 스키마 = DB 안의 폴더 · 화면(PostgREST)은 public 만 본다

CREATE TABLE perf.shot           (LIKE public.shot           INCLUDING ALL);   -- 모양째 (PK · 인덱스 · CHECK · EXCLUDE) · 🔴 FK 는 안 따라온다
CREATE TABLE perf.shot_part      (LIKE public.shot_part      INCLUDING ALL);
CREATE TABLE perf.production_lot (LIKE public.production_lot INCLUDING ALL);

INSERT INTO perf.shot                                  -- 한 줄을 JSON 으로 펼쳐 시각만 바꾸고 다시 접는다 (칸이 28개라)
SELECT (jsonb_populate_record(NULL::perf.shot,
          to_jsonb(s) || jsonb_build_object('measured_at', s.measured_at + k * interval '30 days'))).*
FROM public.shot s
CROSS JOIN generate_series(0, 9) AS k                  -- 번호 공장 0 ~ 9 × 모든 샷 = 10배 (k = 0 이 원본)
WHERE s.measured_at < '2021-01-01';                    -- 2026 시연 데이터는 뺀다

INSERT INTO perf.shot_part
SELECT (jsonb_populate_record(NULL::perf.shot_part,
          to_jsonb(p) || jsonb_build_object('measured_at', p.measured_at + k * interval '30 days'))).*
FROM public.shot_part p
CROSS JOIN generate_series(0, 9) AS k
WHERE p.measured_at < '2021-01-01';

INSERT INTO perf.production_lot
SELECT (jsonb_populate_record(NULL::perf.production_lot,
          to_jsonb(l) || jsonb_build_object(
              'lot_id',     l.lot_id || '-' || k,      -- LOT 번호는 PK — 복사본마다 꼬리표
              'started_at', l.started_at + k * interval '30 days',
              'ended_at',   l.ended_at + k * interval '30 days'))).*
FROM public.production_lot l
CROSS JOIN generate_series(0, 9) AS k
WHERE l.ended_at <> 'infinity';                        -- 🔴 열린 데모 LOT 은 밀어도 무한 — 자기 복사본과 겹쳐 EXCLUDE 에 막힌다

ANALYZE perf.shot;                                     -- 🔵 대량으로 넣은 뒤엔 통계를 새로 — 안 하면 Postgres 가 길을 잘못 고른다
ANALYZE perf.shot_part;
ANALYZE perf.production_lot;

COMMIT;
