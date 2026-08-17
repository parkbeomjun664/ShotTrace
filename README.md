# ShotTrace

> 사출성형 공장의 생산 실적과 품질 이력을 관리하는 MES.
> **LOT과 설비 상태를 시간 구간으로 잇는 것**이 이 시스템의 핵심이다.

제조 IT 22년 경력자 인터뷰로 요구사항을 도출했고, KAMP 공개 실데이터(사출성형기 7,996 샷)를 시간축으로 재생해 사용한다. ISA-95 Level 3에 해당한다.

**현재 상태** — 🚧 개발 중 (2026-08 시작, 2027-02 완료 목표)

---

## 왜 시간 구간 조인인가

현장에서 추적하는 목적은 자재가 아니라 **"그 LOT을 만들 때 설비가 어땠나"**이다. 인터뷰에서 이 얘기를 듣고 설계를 바꿨다.

그래서 `equipment_param`(설비 공정변수 시계열)은 `lot_id` FK를 **갖지 않는다.** `equipment_id`와 `measured_at`만 갖고, LOT 조회는 항상 시간 범위로 조인한다.

```sql
-- LOT 하나를 클릭하면 이 쿼리가 돈다
SELECT * FROM equipment_param
WHERE equipment_id = (SELECT equip_cd FROM production_lot WHERE lot_id = :lot_id)
  AND measured_at >= (SELECT started_at FROM production_lot WHERE lot_id = :lot_id)
  AND measured_at <  (SELECT ended_at   FROM production_lot WHERE lot_id = :lot_id)
ORDER BY measured_at;
```

33개 공정변수와 불량 여부·사유가 이 한 번의 시간 범위 조회로 나온다. **불량이 언제 났고 그 직전 온도·압력이 어땠는지**가 이 쿼리 하나로 붙는다.

이 구조는 `(equipment_id, measured_at)` 복합 인덱스에 전적으로 의존한다. 인덱스가 없으면 LOT 하나 조회할 때마다 전체 테이블을 훑는다.

---

## 아키텍처

```
KAMP 실데이터 (CSV, 7,996 샷 × 33 변수)
      │
      ▼  시뮬레이터가 시간순 재생 (배속 1x / 60x / 3600x)
   MQTT 브로커 (Mosquitto)                    ← Level 2
      │
      ▼  수집기 구독 → upsert (멱등)
   Supabase / PostgreSQL                      ← Level 3
      │
      ▼  시간 구간 조인
   Next.js App Router (Vercel)
```

실제 공장이라면 센서 → PLC → 게이트웨이가 MQTT 앞단에 붙는다. 이 프로젝트는 그 부분만 시뮬레이터로 대체했고, **브로커 이후는 실제 공장과 구조가 같다.**

---

## 데이터 모델

| 테이블 | 성격 | 행 수 |
|---|---|---|
| `equipment` | 마스터 — 설비 | 3 |
| `product` | 마스터 — 제품 | 6 |
| `production_lot` | 운영 — LOT (`started_at` ~ `ended_at`) | 25 |
| `equipment_param` | 운영 — 공정변수 시계열 | ~7,996 |

`production_lot`은 `EQUIP_CD + PLAN_DATE + PART_NAME` 조합으로 정의했고, 원본 7,996행을 실제 groupby로 검증해 25개 LOT을 확인했다.

원본 45개 변수 중 **유효 33개**만 사용한다. 나머지 12개(금형온도 10~12번, 배럴온도 7번, 절환위치 등)는 전 구간 0으로 측정되는 죽은 컬럼이다.

---

## 기술 스택

| 영역 | 선택 |
|---|---|
| DB | Supabase (PostgreSQL) — 스키마는 SQL 마이그레이션으로만 관리 |
| 웹 | Next.js 16 App Router · React 19 · TypeScript |
| 스타일 · UI | Tailwind · shadcn/ui · Recharts |
| 서버 상태 | TanStack Query · Zod |
| ETL | TypeScript (일회성 적재 스크립트) |
| 파이프라인 | Node.js · TypeScript · mqtt.js · Mosquitto (Docker) |
| 테스트 | Vitest · Playwright |
| 배포 | Vercel (웹) |

---

## 폴더 구조

```
db/migrations/     스키마의 유일한 진실. 대시보드 클릭으로 바꾸지 않는다
scripts/etl/       CSV → Supabase 적재 (TypeScript, 일회성)
apps/web/          Next.js
services/
  simulator/       CSV를 시간순 MQTT 발행
  collector/       MQTT 구독 → DB 적재
docs/
  강의/            학습 커리큘럼과 강의 노트
  decisions/       ADR — 설계 결정 기록
  evidence/        EXPLAIN 결과 · 벤치마크 · 스크린샷
```

---

## 데이터셋

KAMP(인공지능 중소벤처 제조 플랫폼)에서 공개한 **사출성형기 AI 데이터셋**을 사용한다.
용량 문제로 저장소에 포함하지 않았다. `data/` 폴더에 `labeled_data.csv`를 두면 ETL 스크립트가 읽는다.

---

## 로드맵

| 시기 | 목표 |
|---|---|
| 2026-08 | 스키마 확정 · 데이터 적재 · 핵심 쿼리 검증 · 배포 파이프라인 |
| 2026-09 | 현황판 · LOT 추적 · 불량 파레토 (정적 데이터) |
| 2026-10 | 실시간 파이프라인 — **MVP 완성** |
| 2026-11 | 인증 · 실적 입력 · 마스터 관리 |
| 2026-12 | LLM 대응 가이드 · OEE |
| 2027-01 | 테스트 · 성능 · 관측성 |
| 2027-02 | 문서화 · 공개 준비 |

---

## 배경 문서

- `docs/커리큘럼 — 프론트에서 MES까지.html` — 이 프로젝트를 완성하기 위한 학습 커리큘럼 (28모듈)
- `docs/decisions/` — 설계 결정과 그 근거
