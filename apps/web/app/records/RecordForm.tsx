"use client";   // 🔴 1행 — 우체통(훅)은 브라우저에서 돈다

import { useActionState } from "react";

import { createRecord } from "./actions";            // 서버 함수를 그대로 import — fetch 를 안 쓴다

export default function RecordForm({ lotIds }: { lotIds: string[] }) {
  const [state, formAction, pending] = useActionState(createRecord, null);   // [쪽지, 꽂을 action, 가는 중?] · 처음 쪽지는 null

  return (
    <form action={formAction} className="mt-6 max-w-sm space-y-3"> {/* 🔴 createRecord 를 바로 꽂으면 쪽지가 사라진다 */}
      <select name="lotId" required defaultValue="" className="w-full rounded border px-3 py-2 text-sm">{/* 🔴 name = 서버의 formData.get() 철자 */}
        <option value="" disabled>{/* 빈 값 "" — 안 고르면 Zod 의 min(1) 에 걸린다 */}
          LOT 을 고르세요
        </option>
        {lotIds.map((id) => (
          <option key={id} value={id}>
            {id}
          </option>
        ))}
      </select>
      <div className="flex gap-3">
        <input name="passQty" type="number" min={0} required placeholder="양품" className="w-full rounded border px-3 py-2 text-sm" /> {/* required · min 은 안내문 — 진짜 검사는 Zod */}
        <input name="failQty" type="number" min={0} placeholder="불량" className="w-full rounded border px-3 py-2 text-sm" /> {/* 비우면 "" → 0 */}
      </div>
      <button
        disabled={pending}                               // 저장 중엔 잠근다 — 🔴 더블클릭을 줄일 뿐, 진짜 방어는 DB (내일)
        className="w-full rounded bg-black py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "저장 중…" : "저장"}
      </button>
      {state && <p className={state.ok ? "text-sm text-green-700" : "text-sm text-red-600"}>{state.message}</p>} {/* 쪽지가 오면 초록/빨강 */}
    </form>
  );
}
