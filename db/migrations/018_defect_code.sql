-- 018_defect_code.sql — 불량 사유에 명단을 붙인다

BEGIN;

CREATE TABLE defect_code (                             -- ① 만들기 — 불량 사유 명단 (마스터)
    reason  text PRIMARY KEY CHECK (length(trim(reason)) > 0),   -- 자연키 — 글자 그대로가 키 · 공백만은 막는다
    active  boolean NOT NULL DEFAULT true             -- 마스터는 지우지 않고 사용 중지
);

INSERT INTO defect_code (reason)                       -- ② 채우기 — 손으로 안 적고 지금 있는 사유를 골라 담는다
SELECT DISTINCT fail_reason                            -- 61줄 → 3개
FROM shot_part
WHERE fail_reason IS NOT NULL;                         -- 양품은 NULL — PK 에 못 들어간다

ALTER TABLE shot_part                                  -- ③ 묶기 — 이 순간 5,314줄을 전부 검사한다
    ADD CONSTRAINT part_fail_reason_known
    FOREIGN KEY (fail_reason) REFERENCES defect_code(reason)   -- 🔵 FK 는 NULL 을 검사하지 않는다 — 양품은 통과
    ON UPDATE CASCADE;                                 -- 명단의 이름을 바꾸면 가리키는 쪽도 DB 가 같이 바꾼다

ALTER TABLE defect_code ENABLE ROW LEVEL SECURITY;     -- 쓰기 정책 없음 — 마스터 화면 전까지 SQL Editor 로만

CREATE POLICY "read_staff" ON defect_code
    FOR SELECT TO authenticated USING ((SELECT public.app_role()) IS NOT NULL);

COMMIT;
