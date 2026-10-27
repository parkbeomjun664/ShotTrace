// 범례 (10/27) — "호박색은 95% 미만, 빨강은 …" 같은 긴 문장 대신 색 견본 + 두세 낱말
// 견본은 차트 · 표가 실제로 쓰는 색 그대로 — 글로 색 이름을 읽지 않아도 눈이 바로 짝을 찾는다
import type { CSSProperties, ReactNode } from "react";

export type LegendItem = { mark: ReactNode; label: ReactNode };

export function Legend({ items, className = "" }: { items: LegendItem[]; className?: string }) {
  return (
    <ul className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground ${className}`}>
      {items.map((it, i) => (
        <li key={i} className="flex items-center gap-1.5">
          <span aria-hidden className="flex h-4 w-5 shrink-0 items-center justify-center">
            {it.mark}
          </span>
          {it.label}
        </li>
      ))}
    </ul>
  );
}

// ── 견본들 ─────────────────────────────────────────────
// 점 — 상태 색 (className: bg-status-warn 등)
export const Dot = ({ className }: { className: string }) => <span className={`size-2.5 rounded-full ${className}`} />;
// 칸 — 막대 · 띠 · 칠한 영역 (style 로 아무 배경이나: 색 · 빗금)
export const Box = ({ className = "", style }: { className?: string; style?: CSSProperties }) => (
  <span className={`h-3 w-5 rounded-sm ${className}`} style={style} />
);
// 가로 점선 — 목표선 · 기준선
export const Dash = () => <span className="w-5 border-t-2 border-dashed border-current opacity-70" />;
// 세로 점선 — 샷 없음 구간
export const VDash = () => <span className="h-4 border-l-2 border-dashed border-current opacity-70" />;
// 선 + 점 — 누적 꺾은선
export const LineDot = ({ color }: { color: string }) => (
  <span className="relative flex w-5 items-center">
    <span className="h-0.5 w-full" style={{ background: color }} />
    <span className="absolute left-1/2 size-1.5 -translate-x-1/2 rounded-full" style={{ background: color }} />
  </span>
);
// 마름모 테두리 — 불량 샷
export const Diamond = ({ color }: { color: string }) => <span className="size-2.5 rotate-45 border-[1.5px]" style={{ borderColor: color }} />;
