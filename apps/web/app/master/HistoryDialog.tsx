"use client";   // 🔴 1행 — 모달은 브라우저에서

// 줄마다 「이력」 — 트리거가 적은 변경 전 · 후 (028 master_audit · 10/26). 읽기만 — 이력은 아무도 고치지 못한다
import { useRef } from "react";

export type HistoryEntry = { id: number; at: string; action: string; by: string; changes: { field: string; from: string; to: string }[] };

export function HistoryDialog({ title, entries }: { title: string; entries: HistoryEntry[] }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" onClick={() => ref.current?.showModal()} className="rounded border px-2 py-1 text-xs hover:bg-muted" aria-label={`${title} 변경 이력`}>
        이력{entries.length ? ` ${entries.length}` : ""}
      </button>
      <dialog ref={ref} className="m-auto whitespace-normal w-full max-w-lg rounded-xl border p-6 text-left backdrop:bg-black/30">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{title} · 변경 이력</h2>
          <button type="button" onClick={() => ref.current?.close()} aria-label="닫기" className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
        {entries.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">변경 이력이 없어요 — 028 이후의 추가 · 수정부터 남아요</p>
        ) : (
          <ol className="mt-4 max-h-96 space-y-3 overflow-y-auto text-sm">
            {entries.map((e) => (
              <li key={e.id} className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">
                  {e.at} · {e.action === "INSERT" ? "추가" : "수정"} · {e.by}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {e.changes.map((c) => (
                    <li key={c.field} className="font-mono text-xs">
                      {c.field}: {e.action === "INSERT" ? c.to : `${c.from} → ${c.to}`}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </dialog>
    </>
  );
}
