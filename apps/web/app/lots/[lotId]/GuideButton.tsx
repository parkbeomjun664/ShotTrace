"use client";   // 🔴 1행 — 버튼과 우체통(훅)만 브라우저에서. Claude 는 actions.ts(서버)가 부른다

import { useActionState } from "react";

import { createGuide } from "./actions";

export default function GuideButton({ lotId }: { lotId: string }) {
  const [state, formAction, pending] = useActionState(createGuide, null);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="lotId" value={lotId} />
      <button
        disabled={pending}                             // 🔵 누르는 동안 잠근다 — 두 번 누르면 택시가 두 대
        className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "만드는 중… (30초쯤 걸려요)" : "대응 가이드 만들기"}
      </button>
      {state && <p className={state.ok ? "text-sm text-green-700" : "text-sm text-red-600"}>{state.message}</p>}
    </form>
  );
}
