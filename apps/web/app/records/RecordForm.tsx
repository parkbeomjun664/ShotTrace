"use client";   // 🔴 1행 — 우체통(훅) · LOT 카드 · 확인 다이얼로그는 브라우저에서

// 실적 입력 (10/26 재구성) — LOT 을 고르면 카드 · 보이는 라벨 · 큰 숫자 칸 · 샷 수 차이 경고 · 저장 전 확인
// 🔴 장부는 고칠 수 없다 — 그래서 저장 전에 한 번 더 보여준다 (정정은 취소 후 재등록, ADR 014)
import { useActionState, useRef, useState } from "react";

import { shotDiffWarn } from "@/lib/records";

import { createRecord } from "./actions";            // 서버 함수를 그대로 import — fetch 를 안 쓴다

export type LotOption = {                              // page 가 읽어서 건네는 LOT 한 건
  id: string;
  product: string;
  equip: string;
  range: string;                                       // 생산 구간 — "10. 27. 09:10 ~ 14:48"
  shots: number;                                       // 설비가 센 수량 (LOT 저장 수량)
  recordedPass: number;                                // 이미 기록된 실적 합계 (살아 있는 줄)
  recordedFail: number;
};

const LOCKED = "둘러보기 계정은 조회만 가능해요";
const INPUT = "h-12 w-full rounded-md border px-3 text-base disabled:opacity-50";

export default function RecordForm({ lots, requestId, readOnly }: { lots: LotOption[]; requestId: string; readOnly: boolean }) {
  const [state, formAction, pending] = useActionState(createRecord, null);   // [쪽지, 꽂을 action, 가는 중?]
  const v = state?.values;                             // 반려된 서류
  const [lotId, setLotId] = useState(v?.lotId ?? "");
  const [pass, setPass] = useState(v?.passQty ?? "");
  const [fail, setFail] = useState(v?.failQty ?? "");
  const confirm = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);

  const lot = lots.find((l) => l.id === lotId);
  const entered = (Number(pass) || 0) + (Number(fail) || 0);
  const warn = !!lot && entered > 0 && shotDiffWarn(entered, lot.shots);   // 서버도 같은 함수로 다시 본다

  return (
    <form ref={form} id="record-form" action={formAction} className="space-y-4">
      <input type="hidden" name="requestId" value={requestId} /> {/* 송장 — 성공해야 새 번호 */}

      <div className="space-y-1.5">
        <label htmlFor="rec-lot" className="text-sm font-medium">LOT</label>
        <select
          id="rec-lot"
          name="lotId"
          required
          value={lotId}
          onChange={(e) => setLotId(e.target.value)}
          disabled={readOnly}
          className={INPUT}
        >
          <option value="" disabled>
            LOT을 고르세요
          </option>
          {lots.map((l) => (
            <option key={l.id} value={l.id}>
              {l.id}
            </option>
          ))}
        </select>
      </div>

      {/* LOT 카드 — 무엇을 기록하려는지 눈으로 확인 */}
      {lot && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg bg-muted/60 p-3 text-sm">
          <dt className="text-muted-foreground">제품</dt>
          <dd>{lot.product}</dd>
          <dt className="text-muted-foreground">설비</dt>
          <dd>{lot.equip}</dd>
          <dt className="text-muted-foreground">생산 구간</dt>
          <dd className="tabular-nums">{lot.range}</dd>
          <dt className="text-muted-foreground">샷 수</dt>
          <dd className="tabular-nums">{lot.shots.toLocaleString()}개 (설비 집계)</dd>
          <dt className="text-muted-foreground">기존 기록</dt>
          <dd className="tabular-nums">양품 {lot.recordedPass} · 불량 {lot.recordedFail}</dd>
        </dl>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="rec-pass" className="text-sm font-medium">양품</label>
          <input id="rec-pass" name="passQty" type="number" min={0} step={1} inputMode="numeric" required value={pass} onChange={(e) => setPass(e.target.value)} disabled={readOnly} className={INPUT} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="rec-fail" className="text-sm font-medium">불량</label>
          <input id="rec-fail" name="failQty" type="number" min={0} step={1} inputMode="numeric" value={fail} onChange={(e) => setFail(e.target.value)} disabled={readOnly} className={INPUT} />
        </div>
      </div>

      {/* 샷 수와 10% 넘게 다르면 — 저장은 되지만 이유를 남긴다 */}
      {warn && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          설비가 센 {lot!.shots}개와 10% 넘게 달라요. 저장할 수 있지만 이유를 메모에 적어 주세요.
        </p>
      )}
      <div className="space-y-1.5">
        <label htmlFor="rec-note" className="text-sm font-medium">메모{warn ? " (필수)" : " (선택)"}</label>
        <input id="rec-note" name="note" required={warn} defaultValue={v?.note} disabled={readOnly} className={INPUT} />
      </div>

      {/* 저장 전 확인 — 이 버튼은 다이얼로그만 연다. 진짜 제출은 다이얼로그 안의 버튼(form="record-form") */}
      <button
        type="button"
        disabled={readOnly || pending}
        title={readOnly ? LOCKED : undefined}
        onClick={() => form.current?.reportValidity() && confirm.current?.showModal()}   // 빈 칸이면 브라우저가 먼저 알려 준다
        className="h-12 w-full rounded-md bg-black text-base font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "저장 중…" : "저장"}
      </button>
      {state && <p className={state.ok ? "text-sm text-green-700" : "text-sm text-red-600"}>{state.message}</p>}

      <dialog ref={confirm} className="m-auto w-full max-w-sm rounded-xl border p-6 backdrop:bg-black/30">
        <h2 className="font-semibold">이대로 저장할까요?</h2>
        <p className="mt-2 text-sm text-muted-foreground">저장 후에는 수정할 수 없어요. 정정은 취소 후 재등록으로 남아요.</p>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted-foreground">LOT</dt>
          <dd className="font-mono">{lotId}</dd>
          <dt className="text-muted-foreground">양품 · 불량</dt>
          <dd className="tabular-nums">{Number(pass) || 0} · {Number(fail) || 0}</dd>
        </dl>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={() => confirm.current?.close()} className="rounded-md border px-3 py-1.5 text-sm">
            다시 볼게요
          </button>
          <button type="submit" form="record-form" onClick={() => confirm.current?.close()} className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
            저장
          </button>
        </div>
      </dialog>
    </form>
  );
}
