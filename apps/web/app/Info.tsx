// ⓘ 누르면 뜨는 작은 설명 (10/27) — 부제에서 뺀 계산 방법 · 예외 같은 "궁금한 사람만" 읽을 내용
// popover 속성 — 자바스크립트 없이 브라우저가 열고 닫는다 (바깥을 누르거나 Esc). LOT 상세 「샷을 LOT 에 잇는 방법」과 같다
import type { ReactNode } from "react";

export function Info({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <>
      <button
        popoverTarget={id}
        aria-label={label}
        className="inline-flex size-5 cursor-pointer items-center justify-center rounded-full text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        ⓘ
      </button>
      <div id={id} popover="auto" className="m-auto max-w-sm space-y-2 rounded-lg border bg-background p-4 text-sm leading-relaxed shadow-lg">
        {children}
      </div>
    </>
  );
}
