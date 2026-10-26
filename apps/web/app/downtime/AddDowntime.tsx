"use client";   // 🔴 1행 — 모달을 열고 닫는 건 브라우저

// 「직접 추가」 — 수동 입력 폼을 모달로 (10/26). 화면의 주인공은 타임라인과 미입력 정지 목록이다
// <dialog> 를 쓴다 — Esc 로 닫히고, 포커스가 안에 갇히고, 뒤 화면을 막는다 (접근성을 브라우저가 해 준다)
import { useRef } from "react";

import DowntimeForm from "./DowntimeForm";

type Equipment = { equip_cd: string; equip_name: string };
type Reason = { code: string; name: string; planned: boolean };

export function AddDowntime({
  equipments,
  reasons,
  requestId,
  readOnly,
}: {
  equipments: Equipment[];
  reasons: Reason[];
  requestId: string;
  readOnly: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        onClick={() => ref.current?.showModal()}
        disabled={readOnly}
        title={readOnly ? "둘러보기 계정은 조회만 가능해요" : undefined}
        className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
      >
        직접 추가
      </button>
      <dialog ref={ref} className="m-auto w-full max-w-sm rounded-xl border p-6 backdrop:bg-black/30">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">비가동 직접 추가</h2>
          <button onClick={() => ref.current?.close()} aria-label="닫기" className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
        <DowntimeForm equipments={equipments} reasons={reasons} requestId={requestId} />
      </dialog>
    </>
  );
}
