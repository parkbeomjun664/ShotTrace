# 인덱스 증거 — EXPLAIN ANALYZE

- **날짜**: 2026-09-09
- **관련**: `db/migrations/003_indexes.sql` · [ADR 007](../decisions/007-인덱스.md) · M06 ★
- **데이터**: `shot_part` 5,232행 · `production_lot` 25행

측정 대상 LOT — `S14-20201103-CN7LH` (`product_id = 1`, 463개)
`S14-20201103-CN7RH` (`product_id = 2`, 463개)와 **시간 범위가 완전히 같다**(패밀리 금형, ADR 005).
`product_id` 조건을 빼면 926행이 나온다.

```
equipment_id = 'S14'
measured_at >= '2020-11-03T00:38:12+00:00'
measured_at <  '2020-11-03T08:19:36+00:00'
```

---

## 결과 요약

| | 조건 | 스캔 방법 | cost | 실행 시간 | 행 |
|---|---|---|---|---|---|
| ① | 그대로 | `Index Scan` (새 인덱스) | 0.28..66.27 | **2.442 ms** | 463 |
| ② | 인덱스 끔 | `Seq Scan` | 0.00..211.64 | 10.986 ms | 463 |
| ③ | `product_id` 제거 | `Index Scan` (옛 UNIQUE) | — | 11.463 ms | 926 |
| ④ | LOT 정렬 | `Sort` + `Seq Scan` | 1.83..1.89 | 0.157 ms | 25 |

---

## ① 새 인덱스가 쓰인다

```sql
EXPLAIN ANALYZE
SELECT part_id, pass_or_fail, fail_reason
FROM   shot_part
WHERE  equipment_id = 'S14'
  AND  product_id   = 1
  AND  measured_at >= '2020-11-03T00:38:12+00:00'
  AND  measured_at <  '2020-11-03T08:19:36+00:00';
```

```
Index Scan using idx_shot_part_lot_lookup on shot_part  (cost=0.28..66.27 ...)
  Index Cond: ((equipment_id = 'S14'::text) AND (product_id = 1) AND (measured_at >= ...))
Planning Time: 3.911 ms
Execution Time: 2.442 ms
```

세 조건이 모두 `Index Cond` 에 들어갔다. 필터로 버리는 행이 없다.

---

## ② 인덱스를 못 쓰게 하면 — 4.5배 느리다

```sql
SET enable_indexscan = off;
SET enable_bitmapscan = off;
-- 같은 쿼리
RESET ALL;
```

```
Seq Scan on shot_part  (cost=0.00..211.64 rows=326 width=36)
  Filter: ((measured_at >= '2020-11-03 00:38:12+00'::timestamp with time zone) AND ...)
  Rows Removed by Filter: 4769
Planning Time: 22.744 ms
Execution Time: 10.986 ms
```

**`Rows Removed by Filter: 4769`** — `5,232 − 463 = 4,769`. 정확히 일치한다.
필요한 것의 **11배**를 읽고 버린다. cost 3.2배, 실행 시간 4.5배.

---

## ③ 왼쪽 접두사 규칙 — 새 인덱스를 못 쓴다

`product_id` 조건만 뺐다.

```sql
EXPLAIN ANALYZE
SELECT part_id
FROM   shot_part
WHERE  equipment_id = 'S14'
  AND  measured_at >= '2020-11-03T00:38:12+00:00'
  AND  measured_at <  '2020-11-03T08:19:36+00:00';
```

```
Index Scan using shot_part_equipment_id_measured_at_product_id_key on shot_part
  Index Cond: ((equipment_id = 'S14'::text) AND (measured_at >= ...))
Planning Time: 2.938 ms
Execution Time: 11.463 ms
```

**옵티마이저가 새 인덱스가 아니라 옛 UNIQUE 인덱스를 골랐다.**

```
새 인덱스  (equipment_id, product_id, measured_at)
            ①  = 'S14'      ②  조건 없음      ③  못 쓴다
```

가운데 칸이 비면 그 뒤를 못 쓴다. 이것이 왼쪽 접두사 규칙이다.
반대로 옛 인덱스 `(equipment_id, measured_at, product_id)` 는 왼쪽 둘이 연속으로 맞아 쓰인다.

**두 인덱스가 서로 다른 쿼리를 담당한다.** 옵티마이저가 쿼리마다 고른다.

926행이 나오는 이유는 LH·RH가 같은 시간대를 공유하기 때문이다(ADR 005).
`product_id` 조건 하나가 성능과 정확성을 동시에 가른다.

---

## ④ 인덱스를 걸어도 안 쓸 수 있다

```sql
EXPLAIN ANALYZE
SELECT lot_id, started_at FROM production_lot ORDER BY started_at DESC;
```

```
Sort  (cost=1.83..1.89 rows=25 width=40)
  Sort Key: started_at DESC
  Sort Method: quicksort  Memory: 26kB
  ->  Seq Scan on production_lot  (cost=0.00..1.25 rows=25 width=40)
Planning Time: 0.368 ms
Execution Time: 0.157 ms
```

`idx_production_lot_started_at` 을 쓰지 않았다. **25행짜리 테이블은 통째로 읽고
정렬하는 편이 색인을 거쳐 테이블로 25번 왔다 갔다 하는 것보다 싸다.**

인덱스가 낭비는 아니다. LOT은 계속 쌓이고, 행이 늘면 옵티마이저가 스스로 판단을
바꾼다. 코드를 고칠 필요가 없다.

---

## ⑤ 부분 인덱스는 쓰인다 — Index Only Scan (2026-09-18 측정)

```sql
EXPLAIN ANALYZE
SELECT fail_reason, COUNT(*)
FROM   shot_part
WHERE  pass_or_fail = 'N'
GROUP  BY fail_reason;
```

```
GroupAggregate  (cost=0.14..3.57 rows=3 width=17) (actual time=1.917..1.923)
  Group Key: fail_reason
  ->  Index Only Scan using idx_shot_part_defect on shot_part  (cost=0.14..3.24)
        Heap Fetches: 0
Planning Time: 4.794 ms
Execution Time: 2.034 ms
```

**`Index Only Scan` 이고 `Heap Fetches: 0` 이다.** 테이블 본체를 한 번도 안 읽었다.
인덱스에 `fail_reason` 이 들어 있고 쿼리가 원하는 것이 그것뿐이라 색인만으로 답이 나온다.

`Heap Fetches` 가 0이 아니면 이름만 Index Only 이고 결국 테이블을 본다. 0이어야 진짜다.

cost 3.57 — `shot_part` 전체 Seq Scan 이 약 211 이므로 **약 59배 싸다.**
불량이 60/5,232(1.15%)라 색인 항목이 87배 작은 덕이다. **선택도가 낮을수록 효과가 크다.**

### 같은 날 만든 두 인덱스의 운명이 갈렸다

| 인덱스 | 결과 |
|---|---|
| `idx_production_lot_started_at` | **안 쓰임** — 25행이라 Seq Scan + Sort 가 더 싸다 |
| `idx_shot_part_defect` | **쓰임** — 5,232 중 60개만 본다 |

옵티마이저가 매번 계산해서 고른다. **거는 것과 쓰이는 것은 다르다.**

## 남은 것

- 1~2월 성능 심화(R04)에서 **50만 행**으로 같은 실험을 다시 한다.
  특히 ④가 언제 `Index Scan` 으로 바뀌는지 확인할 것.
- ~~부분 인덱스 측정~~ → 2026-09-18 완료 (위 ⑤).
- `idx_production_lot_started_at` 이 몇 행부터 쓰이기 시작하는지 R04 에서 확인한다.
