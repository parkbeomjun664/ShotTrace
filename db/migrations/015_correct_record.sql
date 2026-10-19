-- 015_correct_record.sql — 정정 = 취소 + 새 줄을 한 번에 (M21)

BEGIN;

CREATE FUNCTION correct_record(                        -- 합포장 상자 — 부르는 한 번 = 트랜잭션 하나
    p_record_id  bigint,                               -- p_ = 받은 값
    p_pass_qty   int,
    p_fail_qty   int,
    p_reason     text,
    p_request_id uuid                                  -- 새 줄의 번호표 (013) — 같은 정정이 두 번 와도 한 줄
)
RETURNS bigint                                         -- 새 줄 번호
LANGUAGE plpgsql                                       -- 순서 · 변수 · if 가 있는 SQL
SECURITY INVOKER                                       -- 🔴 부른 사람 권한 — DEFINER 면 RLS 를 건너뛰어 viewer 도 정정한다
SET search_path = ''                                   -- 🔴 하이재킹 차단 · 그래서 public. 을 다 붙인다
AS $$
DECLARE
    v_lot_id text;                                     -- v_ = 함수 안의 변수
    v_new_id bigint;
BEGIN
    SELECT lot_id INTO v_lot_id                        -- ① 원래 줄 — 읽은 값을 변수에 담는다
    FROM public.production_record
    WHERE record_id = p_record_id;                     -- RLS 를 거친다 — 못 보는 줄이면 NULL

    IF v_lot_id IS NULL THEN
        RAISE EXCEPTION '없는 실적입니다: %', p_record_id USING ERRCODE = 'P0002';   -- 일부러 멈춘다 — 한 일은 전부 없던 일
    END IF;

    INSERT INTO public.record_cancel (record_id, reason)    -- ② 빨간 줄 — 이미 취소됐으면 PK 가 23505
    VALUES (p_record_id, p_reason);                         --    canceled_by 는 DEFAULT auth.uid() = 부른 사람

    INSERT INTO public.production_record (lot_id, pass_qty, fail_qty, request_id)   -- ③ 새 줄 — 같은 LOT
    VALUES (v_lot_id, p_pass_qty, p_fail_qty, p_request_id)
    RETURNING record_id INTO v_new_id;                 -- 🔴 여기서 실패하면 ② 도 없던 일

    RETURN v_new_id;                                   -- ④
END;
$$;

COMMIT;
