"use client";   // 🔴 1행 — 우체통(훅)은 브라우저에서

import { useActionState } from "react";

import { createDowntime } from "./actions";

type Equipment = { equip_cd: string; equip_name: string };   // page 가 읽어서 건네는 모양
type Reason = { code: string; name: string; planned: boolean };

export default function DowntimeForm({
  equipments,
  reasons,
  requestId,
}: {
  equipments: Equipment[];
  reasons: Reason[];
  requestId: string;
}) {
  const [state, formAction, pending] = useActionState(createDowntime, null);
  const v = state?.values;                             // 반려된 서류 — 한 번 꺼내 짧게 쓴다

  return (
    <form action={formAction} className="mt-6 max-w-sm space-y-3">
      <input type="hidden" name="requestId" value={requestId} /> {/* 번호표 — 성공해야 새 번호 */}
      <select aria-label="설비" key={`e-${v?.equipCd ?? ""}`} name="equipCd" required defaultValue={v?.equipCd ?? ""} className="w-full rounded border px-3 py-2 text-sm">{/* 🔴 key 앞의 e- · r- — 둘 다 "" 이면 형제끼리 key 가 같아진다 */}
        <option value="" disabled>
          설비를 고르세요
        </option>
        {equipments.map((e) => (
          <option key={e.equip_cd} value={e.equip_cd}>
            {`${e.equip_cd} · ${e.equip_name}`}
          </option>
        ))}
      </select>
      <select aria-label="비가동 사유" key={`r-${v?.reasonCode ?? ""}`} name="reasonCode" required defaultValue={v?.reasonCode ?? ""} className="w-full rounded border px-3 py-2 text-sm">
        <option value="" disabled>
          사유를 고르세요
        </option>
        {reasons.map((r) => (
          <option key={r.code} value={r.code}>
            {/* 계획된 정지는 OEE 에서 다르게 센다 — 고를 때 보여준다 */}
            {`${r.name}${r.planned ? " (계획)" : ""}`}
          </option>
        ))}
      </select>
      {/* label 로 감싸면 글자를 눌러도 입력칸으로 — datetime-local 은 placeholder 가 안 보인다 */}
      <label className="block text-xs text-muted-foreground">
        시작
        <input name="startedAt" type="datetime-local" required defaultValue={v?.startedAt} className="mt-1 w-full rounded border px-3 py-2 text-sm" /> {/* 🔴 타임존 없음 — 서버가 +09:00 */}
      </label>
      <label className="block text-xs text-muted-foreground">
        끝
        <input name="endedAt" type="datetime-local" required defaultValue={v?.endedAt} className="mt-1 w-full rounded border px-3 py-2 text-sm" />
      </label>
      <input name="note" defaultValue={v?.note} placeholder="메모 (선택)" className="w-full rounded border px-3 py-2 text-sm" />
      <button
        disabled={pending}
        className="w-full rounded bg-black py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "저장 중…" : "저장"}
      </button>
      {state && <p className={state.ok ? "text-sm text-green-700" : "text-sm text-red-600"}>{state.message}</p>}
    </form>
  );
}
