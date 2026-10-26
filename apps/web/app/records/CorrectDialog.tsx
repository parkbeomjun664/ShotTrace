"use client";   // 🔴 1행 — 모달 · 우체통은 브라우저에서

// 원장 줄의 「정정」 — 원래 값이 채워진 모달 (10/26). 별도 정정 섹션을 대신한다
// 고치는 게 아니다 — 원래 줄에 빨간 줄(취소) + 새 줄, 함수 하나 · 트랜잭션 하나 (ADR 014 · 015)
import { useActionState, useRef } from "react";

import { correctRecord } from "./actions";

const LOCKED = "둘러보기 계정은 조회만 가능해요";
const INPUT = "h-12 w-full rounded-md border px-3 text-base";

export function CorrectDialog({
  recordId,
  lotId,
  pass,
  fail,
  requestId,
  readOnly,
}: {
  recordId: number;
  lotId: string;
  pass: number;
  fail: number;
  requestId: string;                                   // 서버가 뽑아 준 번호표 — 같은 정정이 두 번 와도 한 줄
  readOnly: boolean;
}) {
  const [state, formAction, pending] = useActionState(correctRecord, null);
  const ref = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        disabled={readOnly}
        title={readOnly ? LOCKED : undefined}
        className="rounded border px-2 py-0.5 text-xs hover:bg-muted disabled:opacity-50"
      >
        정정
      </button>
      <dialog ref={ref} className="m-auto whitespace-normal w-full max-w-sm rounded-xl border p-6 text-left backdrop:bg-black/30">
        <h2 className="font-semibold">실적 정정</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-mono">{lotId}</span> · 원래 줄은 취소선으로 남고 새 줄이 생겨요
        </p>
        <form action={formAction} className="mt-4 space-y-3">
          <input type="hidden" name="recordId" value={recordId} />
          <input type="hidden" name="requestId" value={requestId} />
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1.5 text-sm font-medium">
              양품
              <input name="passQty" type="number" min={0} step={1} inputMode="numeric" required defaultValue={pass} className={INPUT} />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              불량
              <input name="failQty" type="number" min={0} step={1} inputMode="numeric" defaultValue={fail} className={INPUT} />
            </label>
          </div>
          <label className="block space-y-1.5 text-sm font-medium">
            정정 사유 (필수)
            <input name="reason" required className={INPUT} />
          </label>
          {state && <p className={state.ok ? "text-sm text-green-700" : "text-sm text-red-600"}>{state.message}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => ref.current?.close()} className="rounded-md border px-3 py-1.5 text-sm">
              닫기
            </button>
            <button disabled={pending} className="rounded-md bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black">
              {pending ? "정정 중…" : "정정"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
