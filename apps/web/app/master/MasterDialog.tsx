"use client";   // 🔴 1행 — 모달 · 우체통은 브라우저에서

// 마스터 추가 · 수정 모달 (028 · 10/26) — 칸(children)은 서버 화면이 그려 넘긴다. 여기는 열고 · 보내고 · 쪽지만
import { useActionState, useRef, type ReactNode } from "react";

import { saveMaster } from "./actions";

export function MasterDialog({
  button,
  title,
  table,
  recordKey = "",
  children,
}: {
  button: string;                                      // 여는 버튼 글자 — "추가" · "수정"
  title: string;
  table: string;
  recordKey?: string;                                  // 수정이면 그 줄의 키
  children: ReactNode;                                 // 칸들 — 보이는 라벨 + 기본값
}) {
  const [state, formAction, pending] = useActionState(saveMaster, null);
  const ref = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className={button === "추가" ? "rounded-md border px-3 py-1.5 text-sm hover:bg-muted" : "rounded border px-2 py-1 text-xs hover:bg-muted"}
      >
        {button}
      </button>
      {/* 🔴 whitespace-normal — 표 칸(whitespace-nowrap) 안에 있어서 줄바꿈 금지를 물려받았다: 라벨과 입력칸이 한 줄로 붙어 넘쳤다 (10/26) */}
      <dialog ref={ref} className="m-auto whitespace-normal w-full max-w-sm rounded-xl border p-6 text-left backdrop:bg-black/30">
        <h2 className="font-semibold">{title}</h2>
        <form action={formAction} className="mt-4 space-y-3">
          <input type="hidden" name="table" value={table} />
          <input type="hidden" name="key" value={recordKey} />
          {children}
          {state && <p className={state.ok ? "text-sm text-green-700" : "text-sm text-red-600"}>{state.message}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => ref.current?.close()} className="rounded-md border px-3 py-1.5 text-sm">
              닫기
            </button>
            <button disabled={pending} className="rounded-md bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black">
              {pending ? "저장 중…" : "저장"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

// 칸 하나 — 보이는 라벨 + 입력 (서버 화면에서 쓴다)
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}
