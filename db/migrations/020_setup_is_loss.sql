-- 020_setup_is_loss.sql — 셋업(금형 교체)은 손실이다 (M24 · 현장 피드백 10/22)
-- 017 에서 계획 정지(planned = true)로 넣었다 → OEE 가동률의 분모에서 빠져 가동률이 부푼다.
-- 현장도 교과서(6대 로스)도 셋업은 줄여야 할 손실이다. 값 하나지만 왜 바꿨는지 남기려고 마이그레이션으로.

BEGIN;

UPDATE downtime_reason                                 -- 마스터의 기본값은 모델의 일부 — SQL Editor 한 줄로 고치지 않는다
SET planned = false
WHERE code = 'MOLD_CHANGE';                            -- 🔴 WHERE 가 생명 — 빼면 여섯 개가 전부 false (에러 없이)

COMMIT;                                                -- 남은 계획 정지: PM(정기 점검) · BREAK(휴식 · 식사)
