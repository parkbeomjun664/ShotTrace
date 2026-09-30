-- 008_received_at.sql — 이벤트 시각과 처리 시각을 나눈다 (M17 · ADR 002)
--
-- measured_at  이벤트 시각 — 설비가 찍은 때.   조인 · LOT · 수율의 기준
-- received_at  처리 시각  — 수집기가 받은 때. "방금 들어왔나" 의 기준
--
-- 재생 중에는 둘이 6년 차이가 난다. 진짜 설비면 0.1초다.
--
--   🔴 DEFAULT 를 나중에 거는 이유 — 기존 행에 거짓 시각을 심지 않으려고

ALTER TABLE shot ADD COLUMN received_at timestamptz;

ALTER TABLE shot ALTER COLUMN received_at SET DEFAULT now();
