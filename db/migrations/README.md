# 마이그레이션

스키마의 유일한 진실. **대시보드에서 클릭으로 테이블을 만들지 않는다.**

## 규칙

1. **번호 순서대로 실행하면 현재 상태가 나온다** — 이게 항상 성립해야 한다
2. **이미 적용한 파일은 수정하지 않는다.** 바꾸려면 새 파일을 추가한다
3. 되돌릴 수 있게 `NNN_xxx.down.sql`을 같이 쓴다
4. 적용할 때마다 TS 타입을 재생성하고 **함께 커밋**한다

```bash
supabase gen types typescript --project-id <id> > apps/web/types/database.ts
```

## 순서

| 파일 | 내용 |
|---|---|
| `001_init.sql` | 테이블 4개 |
| `002_indexes.sql` | 복합 인덱스 |
| `003_views.sql` | View · RPC |
| `004_auth.sql` | RLS 정책 |
| `005_records.sql` | 실적 · 취소 후 재등록 |
| `006_constraints.sql` | EXCLUDE · 부분 인덱스 |
| `007_downtime.sql` | downtime · defect_code |

## 운영 중 변경

```sql
-- 안전
ALTER TABLE x ADD COLUMN y text;              -- NULL 허용이면 즉시
CREATE INDEX CONCURRENTLY ...;                -- 락 없이

-- 위험
ALTER TABLE x ADD COLUMN y text NOT NULL;     -- 기존 행이 NULL이라 실패
ALTER TABLE x ALTER COLUMN y TYPE int;        -- 전체 재작성 + 락
ALTER TABLE x DROP COLUMN y;                  -- 되돌릴 수 없음
```

`NOT NULL`은 세 단계로 — ① NULL 허용 추가 → ② UPDATE로 채움 → ③ SET NOT NULL
