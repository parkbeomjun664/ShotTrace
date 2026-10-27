# 10배 데이터에서 인덱스가 버티나 — EXPLAIN ANALYZE

- **날짜**: 2026-10-26
- **관련**: [003-indexes-explain.md](003-indexes-explain.md) (9월 · 1배) · [ADR 007](../decisions/007-인덱스.md)
- **방법**: `scripts/perf/build_10x.sql` → `scripts/perf/explain_10x.sql` → `DROP SCHEMA perf CASCADE`

## 데이터

실 Supabase 안의 **별도 스키마 `perf`** 에 진짜 표를 모양째(`LIKE … INCLUDING ALL`) 복사하고, 2020 데이터를
**30일씩 밀어 10벌** 넣었다(`generate_series(0, 9)` · `CROSS JOIN` · `jsonb_populate_record`). 분포(사이클 · 불량 ·
샷 틈)는 진짜 그대로다. 화면(PostgREST)은 `public` 만 보므로 섞이지 않는다. 넣은 뒤 `ANALYZE`.

| 표 | 원본 | 10배 |
|---|---|---|
| `shot` | 2,626 | 26,260 |
| `shot_part` | 5,232 | 52,320 |
| `production_lot` | 26 | 260 |

## 결과

| | 쿼리 | 길 | 1배 | 10배 |
|---|---|---|---|---|
| ① | LOT 하나의 부품 | `Index Scan` (equipment_id · product_id · measured_at) | 2.44 ms (9월) | **0.47 ms** |
| ② | 같은 쿼리 · 인덱스 끔 | `Seq Scan` + `Hash Join` · 버린 줄 19,387 | 10.99 ms (9월) | **13.80 ms** |
| | ② ÷ ① | | 4.5배 | **약 30배** |
| ④⑤ | 모든 LOT 의 샷 수 (OEE 재료의 가장 무거운 부분) | `Index Only Scan` + `Memoize` | 4.18 ms | **34.28 ms** (8.2배) |

측정 LOT — `S14-20201103-CN7LH-5` (원본 `S14-20201103-CN7LH` 를 150일 민 복사본 · 463개).

## 읽는 법

- **인덱스 길은 데이터 크기와 거의 상관없다.** 인덱스는 찾을 양(LOT 하나 = 463줄)만 읽는다. 10배가 돼도 1 ms 아래.
- **인덱스 없는 길은 표 전체를 읽는다.** 표가 클수록 느려져 둘의 차이가 4.5배 → 30배로 벌어졌다.
  **인덱스의 가치는 데이터가 클수록 커진다** — 9월 "5천 줄에선 둘 다 빠르다" 를 숫자로 확인했다.
- **모든 LOT 집계는 데이터에 비례한다**(10배 → 8.2배). 전부 세야 하니 인덱스로 피할 수 없다.
  그래도 인덱스만 읽고(`Index Only Scan` · `Heap Fetches: 0`) 표에는 들르지 않았다.

## 🔴 다음에 볼 곳

선형으로 늘려 보면 100배에서 LOT 하나는 여전히 ~0.5 ms, **모든 LOT 집계는 ~350 ms** 다.
`/oee` 는 LOT 전체를 한 번에 계산하므로 데이터가 커지면 **여기가 먼저 느려진다**. 해법 후보 — 기간을 정해서 보기 ·
닫힌 LOT 의 OEE 를 미리 계산해 두기(Materialized View). 지금(34 ms)은 손대지 않는다. 100배 실험은 12월 계획.

## 덤

- `LIKE … INCLUDING ALL` 은 인덱스를 복사하면서 **이름을 새로 짓는다** — 원본 `idx_shot_part_lot_lookup` 이
  `perf` 에서는 `shot_part_equipment_id_product_id_measured_at_idx`. 같은 인덱스다.
- 원본(`public`)의 `Index Only Scan` 은 `Heap Fetches: 226`, 복사본은 0 — 최근에 쓴 줄은 "다 보이는 페이지" 표시
  (visibility map)가 아직 없어서 표에 들러 확인한다. VACUUM 이 그 표시를 채운다.
