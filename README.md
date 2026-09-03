# ShotTrace

> 사출성형 공장의 생산 실적과 품질 이력을 관리하는 MES.
> **LOT과 설비 상태를 시간 구간으로 잇는 것**이 이 시스템의 핵심이다.

제조 IT 22년 경력자 인터뷰로 요구사항을 도출했고, KAMP 공개 실데이터(사출성형기 5,232 샷)를 시간축으로 재생해 사용한다. ISA-95 Level 3에 해당한다.

**배포** — https://shot-trace.vercel.app
**현재 상태** — 🚧 개발 중 (2026-08 시작, **2026-12 완성 목표**)

---

## 왜 시간 구간 조인인가

현장에서 추적하는 목적은 자재가 아니라 **"그 LOT을 만들 때 설비가 어땠나"**이다. 인터뷰에서 이 얘기를 듣고 설계를 바꿨다.

그래서 `equipment_param`(설비 공정변수 시계열)은 `lot_id` FK를 **갖지 않는다.** `equipment_id`와 `measured_at`만 갖고, LOT 조회는 항상 시간 범위로 조인한다.

```sql
-- LOT 하나를 클릭하면 이 쿼리가 돈다
SELECT s.*, sp.pass_or_fail, sp.fail_reason
FROM   production_lot l
JOIN   shot s       ON s.equipment_id = l.equip_cd
                   AND s.measured_at >= l.started_at    -- 반열린 구간
                   AND s.measured_at <  l.ended_at
JOIN   shot_part sp ON sp.equipment_id = s.equipment_id
                   AND sp.measured_at  = s.measured_at
                   AND sp.product_id   = l.product_id
WHERE  l.lot_id = :lot_id
ORDER  BY s.measured_at;
```

24개 공정변수와 불량 여부·사유가 이 한 번의 시간 범위 조회로 나온다. **불량이 언제 났고 그 직전 온도·압력이 어땠는지**가 이 쿼리 하나로 붙는다.

이 구조는 `(equipment_id, measured_at)` 복합 인덱스에 전적으로 의존한다. `shot` 의 기본키가 곧 그 인덱스다. 인덱스가 없으면 LOT 하나 조회할 때마다 전체 테이블을 훑는다.

`shot_part` 로 한 번 더 좁히는 이유는 **패밀리 금형** 때문이다. 설비 S14 는 한 번의 샷에서 LH·RH 두 부품을 동시에 찍는다. 공정변수는 샷의 속성이고 품질은 부품의 속성이라 테이블을 나눴다([ADR 005](docs/decisions/005-샷과-부품-분리.md)).

---

## 아키텍처

```
KAMP 실데이터 (CSV, 부품 5,232 = 샷 2,626 × 24 변수)
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
| `shot` | 운영 — 한 번의 사출. 공정변수 24개 | 2,626 |
| `shot_part` | 운영 — 그 샷에서 나온 부품. 품질 | 5,232 |

`production_lot`은 `EQUIP_CD + PLAN_DATE + PART_NAME` 조합으로 정의했고, 원본 7,996행 중 완전 중복 2,764행을 제거한 5,232행을 실제 groupby로 검증해 25개 LOT을 확인했다(ADR 004).

원본 45개 컬럼 중 12개(금형온도 10개, 배럴온도 7번, 절환위치)는 전 구간 0으로 측정되는 죽은 컬럼이라 뺐다([ADR 003](docs/decisions/003-유효-컬럼.md)). 남은 것은 메타 9개 + **공정변수 24개**다.

원본 7,996행에는 완전 중복 2,764행이 섞여 있었다([ADR 004](docs/decisions/004-중복행-제거.md)). 실적은 설비 3대 중 S14 한 대에 집중돼 있고(5,230행), S01·S12 는 각 1행이다.

---

## 기술 스택

| 영역 | 선택 |
|---|---|
| DB | Supabase (PostgreSQL) — 스키마는 SQL 마이그레이션으로만 관리 |
| 웹 | Next.js 16 App Router · React 19 · TypeScript |
| 스타일 · UI | Tailwind · shadcn/ui · Recharts |
| 서버 상태 | TanStack Query · Zod |
| ETL | Python · pandas (일회성 적재 스크립트) |
| 파이프라인 | 시뮬레이터 Python(paho-mqtt) · 수집기 TypeScript(mqtt.js) · Mosquitto (Docker) |
| 테스트 | Vitest · Playwright |
| 배포 | Vercel (웹) |

---

## 폴더 구조

```
db/migrations/     스키마의 유일한 진실. 대시보드 클릭으로 바꾸지 않는다
scripts/etl/       CSV → Supabase 적재 (Python, 일회성)
apps/web/          Next.js
services/
  simulator/       CSV를 시간순 MQTT 발행 (Python)
  collector/       MQTT 구독 → DB 적재 (TypeScript)
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
| 2026-09 | 화면을 완성한다 — 인덱스 · View/RPC · 파레토 · 시계열 |
| 2026-10 | 데이터를 흐르게 한다 — 시뮬레이터 · MQTT · 수집기 · 실시간 **MVP** |
| 2026-11 | 기록을 지킨다 — 인증 · 실적 입력 · 트랜잭션 · 마스터 |
| 2026-12 | 차별화하고 마감한다 — OEE · LLM · 테스트 · CI · 문서 **완성** |
| 2027-01~02 | 공부하고 개선한다 — 전체 복습 · 성능 심화 · 리팩터링 · 설명 훈련 |

주 단위·일 단위 계획은 [`docs/일정.md`](docs/일정.md) 에 있다.

---|---|
| 2026-08 | 스키마 확정 · 데이터 적재 · 핵심 쿼리 검증 · 배포 파이프라인 |
| 2026-09 | 현황판 · LOT 추적 · 불량 파레토 (정적 데이터) |
| 2026-10 | 실시간 파이프라인 — **MVP 완성** |
| 2026-11 | 인증 · 실적 입력 · 마스터 관리 |
| 2026-12 | LLM 대응 가이드 · OEE |
| 2027-01 | 테스트 · 성능 · 관측성 |
| 2027-02 | 문서화 · 공개 준비 |

---

## 시작하기

**개발을 시작한다면 → [`docs/START-HERE.md`](docs/START-HERE.md)**
9월 1주에 무엇을 어떤 순서로 할지, 각 단계마다 어느 필기를 펴야 하는지 적어뒀다.

## 배경 문서

- `docs/커리큘럼 — 프론트에서 MES까지.html` — 이 프로젝트를 완성하기 위한 학습 커리큘럼 (30모듈)
- `docs/decisions/` — 설계 결정과 그 근거
