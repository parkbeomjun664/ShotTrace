# 제약 거부 실험 — 코드가 실수해도 DB 가 막는다 (M22)

- **날짜**: 2026-10-20
- **방법**: `scripts/verify/constraints.py` — service_role 로 종류마다 하나씩 일부러 어긴다
  (RLS 를 건너뛰어 제약만 본다 · 요청 하나 = 트랜잭션 하나라 막히면 아무것도 안 남는다)
- **결과**: 12 / 12 막힘 — 구멍 없음

| 종류 | 어긴 것 | 테이블 | 기대 | 실제 | 막은 제약 | |
|---|---|---|---|---|---|---|
| p | 있는 설비 코드로 또 넣기 | `equipment` | 23505 | 23505 | `equipment_pkey` | ✅ |
| u | 있는 제품명으로 또 넣기 | `product` | 23505 | 23505 | `product_part_name_key` | ✅ |
| f | 없는 LOT 에 실적 | `production_record` | 23503 | 23503 | `production_record_lot_id_fkey` | ✅ |
| c | side = 'lh' (소문자) | `product` | 23514 | 23514 | `product_side_check` | ✅ |
| c | 양품 5 + 불량 1 ≠ 생산 10 | `production_lot` | 23514 | 23514 | `lot_qty_sum` | ✅ |
| c | 끝이 시작보다 빠른 LOT | `production_lot` | 23514 | 23514 | `lot_time_order` | ✅ |
| c | 빨간 줄 이유가 공백뿐 | `record_cancel` | 23514 | 23514 | `record_cancel_reason_check` | ✅ |
| x | 같은 설비 · 제품 · 시간이 겹치는 LOT | `production_lot` | 23P01 | 23P01 | `lot_no_overlap` | ✅ |
| f | 명단에 없는 비가동 사유 | `downtime` | 23503 | 23503 | `downtime_reason_code_fkey` | ✅ |
| c | 끝이 미래인 비가동 | `downtime` | 23514 | 23514 | `downtime_not_future` | ✅ |
| x | 같은 설비에서 겹치는 비가동 | `downtime` | 23P01 | 23P01 | `downtime_no_overlap` | ✅ |
| n | 번호표(request_id) 없는 실적 | `production_record` | 23502 | 23502 | `request_id NOT NULL` | ✅ |

종류 — p PRIMARY KEY · u UNIQUE · f FOREIGN KEY · c CHECK · x EXCLUDE · n NOT NULL

## 읽는 법

- **겹침 실험(x)** 의 상대는 실제로 있는 끝난 LOT 이다. 같은 설비 · 제품으로 그 LOT 이 시작한 1분 뒤부터
  끝날 때까지를 새 LOT 으로 열려고 했다. `lot_no_overlap`(009) 이 23P01 로 거절했다
- 없었으면 어땠나 — 모든 칸이 **에러가 아니라 조용히 틀린 숫자**가 된다. 열린 LOT 하나가 미래를 삼켜
  187개가 1,985개로 부푼 것이 10/01 의 실측이다
- 막힌 요청은 트랜잭션째 없던 일이 된다. 실험 뒤에 남은 행은 없다
- 🔴 실험은 한 번에 규칙 하나만 어긴다. 둘을 어기면 먼저 검사되는 쪽(CHECK → UNIQUE · EXCLUDE → FK)이
  이름을 댄다. 처음엔 "명단에 없는 사유" 가 겹침 상대와 같은 시각이라 FK 대신 23P01 이 나왔다
- 🔵 `lot_qty_sum` · `lot_time_order` 는 016 에서 이름을 붙였다. 그 전에는 `production_lot_check` · `_check1` 로
  찍혀서 에러만 보고는 무엇을 어겼는지 알 수 없었다. **제약에는 이름을 붙인다**

면접 문장 — **"애플리케이션 버그로 겹치는 LOT 이 들어가면요?" → "DB 가 막습니다. 23P01 로 거절됩니다."**
