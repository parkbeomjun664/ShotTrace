# 개발 착수 체크리스트

> 강의는 2026-08-29에 끝났다. 여기부터는 만드는 일이다.
> 각 항목에 **어느 필기를 펴야 하는지** 적어뒀다. 먼저 그 모듈을 훑고 시작한다.

---

## 9월 1주 — 파이프라인이 끝에서 끝까지 한 번 도는 것이 목표

화면이 비어 있어도 좋다. **데이터가 DB에 있고 배포된 URL이 뜨는 것**까지가 이번 주다.

### 1. Supabase 프로젝트 생성 · 📓 M03

- [ ] 프로젝트 생성 (region: Northeast Asia — Seoul)
- [ ] `.env.example`을 `.env`로 복사하고 키 채우기
- [ ] `.env`가 git에 안 잡히는지 확인 — `git status`

> 🔴 `service_role key`에 `NEXT_PUBLIC_`을 붙이지 않는다.

### 2. `001_init.sql` 작성 · 📓 M02 · M03

- [ ] `db/migrations/001_init.sql` 작성 (파일에 체크리스트가 있다)
- [ ] SQL Editor에서 실행
- [ ] RLS 켜고 **읽기 정책만** 부여
- [ ] `supabase gen types typescript` → `apps/web/types/database.ts`
- [ ] 커밋

**먼저 정해야 할 것 두 가지 — ADR로 남긴다**

- [ ] `timestamptz` vs `timestamp` → `docs/decisions/002-타임존.md`
- [ ] 죽은 컬럼 12개를 남길지 뺄지 → `docs/decisions/003-유효-컬럼.md`

### 3. ETL — 데이터 적재 · 📓 M05 · M14

- [ ] `data/labeled_data.csv` 배치 (gitignore되어 있다)
- [ ] **루트에** venv 만들고 `pip install -r scripts/etl/requirements.txt` (venv는 하나만!)
equirements.txt` (venv는 하나만!)
- [ ] `scripts/etl/load.py` 작성 (파일에 순서가 있다)
- [ ] 실행 후 **검증 쿼리** — 행 수 · 합계 · `'None'` 잔존 여부

**여기서 정해질 것**

- [ ] `ended_at = MAX + 1초` 처리 → `docs/decisions/004-lot-경계.md`

### 4. 웹에서 DB 읽기 · 📓 M08

- [ ] Supabase 클라이언트 2종 (서버용 / 클라이언트용)
- [ ] 서버 컴포넌트에서 LOT 25행을 읽어 화면에 출력
- [ ] `service_role key`가 브라우저 번들에 없는지 확인

### 5. 🚩 Vercel 배포

- [ ] 저장소 연결 · 환경변수 등록
- [ ] 배포 URL 접속 확인
- [ ] README에 URL 추가

> 화면이 초라해도 배포한다. **파이프라인이 도는 걸 먼저 확인**하는 게 목적이다.

---

## 9월 2~4주

### 인덱스와 증거 · 📓 M06 ★

- [ ] `002_indexes.sql`
- [ ] EXPLAIN 3종 → `docs/evidence/`
      (없이 / 있이 / 컬럼 순서 반대로)

### 쿼리 · 📓 M11

- [ ] `daily_yield` View
- [ ] `defect_pareto` View
- [ ] `get_lot_shots` RPC ← 시간 구간 조인

### 화면 · 📓 M09 · M10 · M12 · M13

- [ ] 와이어프레임 (화면 4개 · 각 화면이 답하는 질문 3개씩)
- [ ] 현황판 — 수율 · 설비 상태 · 파레토
- [ ] LOT 추적 ★ — 시계열 + 불량 오버레이
- [ ] 갱신 정책 → `docs/decisions/005-갱신-정책.md`

---

## 10월 이후

`docs/커리큘럼 — 프론트에서 MES까지.html` 06절의 모듈별 산출물을 따른다.

---

## 막혔을 때 · 📓 M04

```
0~5분    에러 코드를 정확히 읽는다 (메시지보다 코드)
5~15분   최소 재현을 만든다        ← 절반은 여기서 풀림
15~25분  공식 문서를 확인한다
25~30분  질문을 작성한다           ← 쓰다가 풀리기도
```

질문 3요소 — **① 기대한 것 ② 나온 것 ③ 해본 것**

---

## 매일 지키는 것

- **하루 1커밋** — 메시지는 "무엇을"이 아니라 **"왜"**
- **결정하면 ADR 3줄** — 무엇을 · 왜 · 버린 대안
- **측정하면 evidence에** — EXPLAIN · 수치 · 스크린샷
