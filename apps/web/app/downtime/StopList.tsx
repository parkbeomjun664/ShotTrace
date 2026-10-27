"use client";   // 🔴 1행 — 체크박스 · 우체통(훅)은 브라우저에서

// 정지 목록 — 체크하고 사유 하나를 골라 「선택 항목 기록」 (10/26)
// 줄마다 id="stop-…" — 타임라인의 빗금을 누르면 주소 #stop-… 로 이 줄까지 내려오고 2초 강조(:target · globals.css)
import Link from "next/link";
import { useActionState, useRef } from "react";

import { confirmStops } from "./actions";

export type StopItem = { key: string; anchor: string; equipCd: string; lotId: string; range: string; minutes: number };
type Reason = { code: string; name: string; planned: boolean };
const LOCKED = "둘러보기 계정은 조회만 가능해요";

export function StopList({ items, reasons, readOnly }: { items: StopItem[]; reasons: Reason[]; readOnly: boolean }) {
  const [state, formAction, pending] = useActionState(confirmStops, null);
  const form = useRef<HTMLFormElement>(null);
  const toggleAll = (on: boolean) =>
    form.current?.querySelectorAll<HTMLInputElement>('input[name="stop"]').forEach((c) => (c.checked = on));

  return (
    <form ref={form} action={formAction}>
      <div className="mt-3 overflow-x-auto rounded-xl border">
        {/* 🔴 주석을 <table> 뒤에 두면 공백이 "글자" 로 들어간다 — 그래서 여기 */}
        <table className="w-full whitespace-nowrap text-sm">
          <thead className="border-b text-muted-foreground">
            <tr>
              <th className="w-10 px-4 py-2">
                <input type="checkbox" aria-label="모두 선택" disabled={readOnly} title={readOnly ? LOCKED : undefined} onChange={(e) => toggleAll(e.target.checked)} />
              </th>
              <th className="px-4 py-2 font-medium">설비</th>
              <th className="px-4 py-2 font-medium">LOT</th>
              <th className="px-4 py-2 font-medium">시작 ~ 종료</th>
              <th className="px-4 py-2 font-medium">길이</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.key} id={s.anchor} className="target-flash border-b last:border-0">
                <td className="px-4 py-2">
                  <input type="checkbox" name="stop" value={s.key} aria-label={`${s.range} 선택`} disabled={readOnly} title={readOnly ? LOCKED : undefined} />
                </td>
                <td className="px-4 py-2 font-mono">{s.equipCd}</td>
                <td className="px-4 py-2 font-mono">
                  <Link href={`/lots/${s.lotId}`} className="hover:underline">{s.lotId}</Link>
                </td>
                <td className="px-4 py-2 tabular-nums text-muted-foreground">{s.range}</td>
                <td className="px-4 py-2 tabular-nums">{s.minutes}분</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          aria-label="정지 사유"
          name="reasonCode"
          required
          defaultValue=""
          disabled={readOnly}
          title={readOnly ? LOCKED : undefined}
          className="rounded border px-2 py-1.5 text-sm disabled:opacity-50"
        >
          <option value="" disabled>
            사유 선택
          </option>
          {reasons.map((r) => (
            <option key={r.code} value={r.code}>
              {`${r.name}${r.planned ? " (계획)" : ""}`}
            </option>
          ))}
        </select>
        <button
          disabled={readOnly || pending}
          title={readOnly ? LOCKED : undefined}
          className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {pending ? "기록 중…" : "선택 항목 기록"}
        </button>
        {state && <span className={state.ok ? "text-sm text-green-700" : "text-sm text-red-600"}>{state.message}</span>}
      </div>
    </form>
  );
}
