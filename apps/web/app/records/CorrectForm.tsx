"use client";   // 🔴 1행 — 우체통(훅)은 브라우저에서

import { useActionState } from "react";

import type { RecentRecord } from "@/lib/queries";   // type = 모양만 — 서버 코드는 안 딸려 온다

import { correctRecord } from "./actions";

export default function CorrectForm({ records, requestId, readOnly = false }: { records: RecentRecord[]; requestId: string; readOnly?: boolean }) {
  const [state, formAction, pending] = useActionState(correctRecord, null);   // RecordForm 과 같은 우체통

  return (
    <form action={formAction} className="mt-4 max-w-sm space-y-3">
      <input type="hidden" name="requestId" value={requestId} /> {/* 정정에도 번호표 — 같은 정정이 두 번 와도 한 줄 */}
      <select aria-label="정정할 실적" name="recordId" required defaultValue="" className="w-full rounded border px-3 py-2 text-sm">{/* 살아 있는 줄만 — 이미 정정된 줄은 목록에 없다 */}
        <option value="" disabled>
          정정할 실적을 고르세요
        </option>
        {records.map((r) => (
          <option key={r.record_id} value={r.record_id}>
            {/* option 은 글자 한 덩어리 — 조각내지 않고 백틱으로 */}
            {`#${r.record_id} · ${r.lot_id} · 양품 ${r.pass_qty} · 불량 ${r.fail_qty}`}
          </option>
        ))}
      </select>
      <div className="flex gap-3">
        <input name="passQty" type="number" min={0} required placeholder="양품" className="w-full rounded border px-3 py-2 text-sm" />
        <input name="failQty" type="number" min={0} placeholder="불량" className="w-full rounded border px-3 py-2 text-sm" />
      </div>
      <input name="reason" required placeholder="정정 이유" className="w-full rounded border px-3 py-2 text-sm" /> {/* 빨간 줄에는 이유 — 감사 때 "왜" 에 답한다 */}
      <button
        disabled={pending || readOnly}                    // 읽기 전용 계정은 잠근다 (10/26)
        className="w-full rounded border py-2 text-sm disabled:opacity-50"   // 테두리만 — 매일 누르는 저장과 눈으로 구별
      >
        {pending ? "정정 중…" : "정정"}
      </button>
      {state && <p className={state.ok ? "text-sm text-green-700" : "text-sm text-red-600"}>{state.message}</p>}
    </form>
  );
}
