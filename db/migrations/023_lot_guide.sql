-- 023_lot_guide.sql — LOT 대응 가이드 보관함 (M25 · LLM 이 만든 것의 영수증)

BEGIN;

CREATE TABLE lot_guide (                               -- 영수증 — 한 번 만들면 다시 부르지 않고 이걸 보여준다 (비용)
    lot_id         text PRIMARY KEY                    -- 🔵 LOT 하나에 가이드 하나 — 두 번 눌러도 두 번째는 23505
                   REFERENCES production_lot(lot_id) ON UPDATE CASCADE,
    content        jsonb NOT NULL,                     -- Claude 의 답 (구조화 출력) — 숫자는 없다, 근거는 이름만
    model          text NOT NULL,                      -- 어느 모델이 답했나 — 대체 모델이 답할 수도 있다
    input_tokens   int  NOT NULL CHECK (input_tokens >= 0),    -- 얼마 들었나 — "한 번에 얼마?" 에 숫자로 답한다
    output_tokens  int  NOT NULL CHECK (output_tokens >= 0),
    created_by     uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
    created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lot_guide ENABLE ROW LEVEL SECURITY;        -- 🔴 UPDATE · DELETE 정책 없음 — 장부와 같다

CREATE POLICY "read_staff" ON lot_guide
    FOR SELECT TO authenticated USING ((SELECT public.app_role()) IS NOT NULL);

CREATE POLICY "insert_worker" ON lot_guide             -- 돈이 드는 버튼 — viewer(공개 계정)는 못 누른다
    FOR INSERT TO authenticated
    WITH CHECK (
        (SELECT public.app_role()) IN ('worker', 'admin')
        AND created_by = (SELECT auth.uid())
    );

COMMIT;
