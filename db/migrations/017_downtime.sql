-- 017_downtime.sql — 비가동과 사유 명단 (OEE 가용성의 재료)

BEGIN;

CREATE TABLE downtime_reason (                         -- 마스터 (메뉴판) — 사유는 한 곳에만 적는다
    code     text PRIMARY KEY,                         -- 읽히는 코드 — 비가동 표만 봐도 무슨 사유인지
    name     text NOT NULL UNIQUE,                     -- 이름도 겹치면 화면에서 구별을 못 한다
    planned  boolean NOT NULL,                         -- 계획된 정지인가 — DEFAULT 없음, 새 사유마다 반드시 정한다
    active   boolean NOT NULL DEFAULT true             -- 🔴 마스터는 지우지 않고 사용 중지
);

INSERT INTO downtime_reason (code, name, planned) VALUES   -- 기본 메뉴 — 사람이 아니라 모델의 일부라 마이그레이션에
    ('MOLD_CHANGE', '금형 교체', true),
    ('PM',          '정기 점검', true),
    ('BREAK',       '휴식 · 식사', true),
    ('BREAKDOWN',   '설비 고장', false),
    ('MATERIAL',    '자재 대기', false),
    ('QUALITY',     '품질 이상', false);

ALTER TABLE downtime_reason ENABLE ROW LEVEL SECURITY;  -- 쓰기 정책 없음 — 마스터 화면 전까지 SQL Editor 로만

CREATE POLICY "read_staff" ON downtime_reason
    FOR SELECT TO authenticated USING ((SELECT public.app_role()) IS NOT NULL);

CREATE TABLE downtime (                                -- 트랜잭션 (주문서) — 장부와 같은 모양: 사람이 쓰고 고치지 않는다
    downtime_id  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    equip_cd     text NOT NULL REFERENCES equipment(equip_cd),
    reason_code  text NOT NULL REFERENCES downtime_reason(code),   -- 사유는 코드로 가리킨다 — 명단에 없으면 못 들어온다
    started_at   timestamptz NOT NULL,
    ended_at     timestamptz NOT NULL,                 -- 끝난 비가동만 — 진행 중(infinity)은 나중 과제
    note         text,                                 -- 코드로 다 못 하는 사정 ("3번 히터 단선") · NULL 허용
    recorded_by  uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
    recorded_at  timestamptz NOT NULL DEFAULT now(),
    request_id   uuid NOT NULL UNIQUE,                 -- 번호표 (013 과 같다)

    CONSTRAINT downtime_time_order CHECK (ended_at > started_at),   -- 처음부터 이름을 붙인다 (016 의 교훈)
    CONSTRAINT downtime_not_future CHECK (ended_at <= now()),       -- 🔵 now() 지만 한 번 참이면 계속 참 — 그래서 괜찮다
    CONSTRAINT downtime_no_overlap EXCLUDE USING gist (            -- 한 설비가 같은 시간에 두 번 멈출 수 없다 (009 와 같은 모양)
        equip_cd WITH =,
        tstzrange(started_at, ended_at) WITH &&                    -- [시작, 끝) 반열린 — 딱 붙은 두 구간은 겹침이 아니다 (ADR 006)
    )
);

ALTER TABLE downtime ENABLE ROW LEVEL SECURITY;         -- 🔴 UPDATE · DELETE 정책 없음

CREATE POLICY "read_staff" ON downtime
    FOR SELECT TO authenticated USING ((SELECT public.app_role()) IS NOT NULL);

CREATE POLICY "insert_worker" ON downtime
    FOR INSERT TO authenticated
    WITH CHECK (
        (SELECT public.app_role()) IN ('worker', 'admin')
        AND recorded_by = (SELECT auth.uid())
    );

COMMIT;
