-- 027_record_note.sql — 실적에 메모 칸 (10/26 · 실적 입력 재구성)
--
-- 왜
--   사람이 센 수량(양품 + 불량)이 설비가 센 샷 수와 10% 넘게 다르면, 그 이유를 같이 남긴다 (화면 · 서버가 메모를 요구한다).
--   차이 자체는 틀린 게 아니다 — 나중에 발견한 불량 · 재작업 · 시험 사출. 이유 없는 차이만 막는다.
--
--   🔵 active_record View(014)는 r.* 로 만들었지만 칸 목록은 만들 때 굳는다 — 새 칸이 View 에 저절로 생기지 않는다.
--      합계는 지금처럼 View 로, 메모는 원장(production_record)에서 직접 읽는다

BEGIN;

ALTER TABLE production_record
    ADD COLUMN note text,                              -- NULL 허용 — 차이가 작으면 비워 둔다
    ADD CONSTRAINT record_note_not_blank CHECK (note IS NULL OR length(trim(note)) > 0);   -- 공백만 넣은 "   " 은 메모가 아니다 (014 의 reason 과 같다)

COMMIT;
