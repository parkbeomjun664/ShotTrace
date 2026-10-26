// 손실 단계 (10/27) — 계획 시간 100% 에서 손실을 하나씩 빼 OEE 가 되는 과정을 가로 막대 네 줄로
// 🔴 워터폴(세로 · 떠 있는 막대)을 대신한다 — "왜 위에서 시작하지?" · "100% 인데 왜 옅지?" 를 처음 보는 사람이 물었다
// 모든 막대는 왼쪽 0 에서 시작. 칠한 몫 = 남은 시간, 빗금 = 이 단계에서 빠진 몫. 차트 라이브러리 없이 div 로 — 서버에서 그린다
// 계산은 lib/oee.ts 의 waterfall() — 여기는 그리기만

type Step = { label: string; hint: string; left: number; lost: number; oee?: boolean };

const STRIPES = "repeating-linear-gradient(135deg, var(--muted-foreground) 0 1.5px, transparent 1.5px 6px)";   // 빗금 = 빠진 몫

export function LossSteps({ a, p, q }: { a: number; p: number; q: number }) {   // 퍼센트(0 ~ 100) · 누적값 — 가동 후 · 성능 후 · 품질 후(= OEE)
  const steps: Step[] = [
    { label: "계획 시간", hint: "돌리기로 한 시간", left: 100, lost: 0 },
    { label: "가동 손실 빼고", hint: "멈춰 있던 시간", left: a, lost: 100 - a },
    { label: "성능 손실 빼고", hint: "표준보다 느리게 돈 시간", left: p, lost: a - p },
    { label: "품질 손실 빼고 = OEE", hint: "불량을 만든 시간", left: q, lost: p - q, oee: true },
  ];

  return (
    <ol className="space-y-4">
      {steps.map((s, i) => (
        <li key={s.label} className="grid items-center gap-x-4 gap-y-1.5 sm:grid-cols-[12rem_1fr_7rem]">
          <div>
            <p className={`text-sm ${s.oee ? "font-semibold" : "font-medium"}`}>{s.label}</p>
            <p className="text-xs text-muted-foreground">{s.hint}</p>
          </div>
          <div className="flex h-7 overflow-hidden rounded bg-muted" aria-hidden>
            <div className={s.oee ? "bg-primary" : "bg-foreground/30"} style={{ width: `${s.left}%` }} />
            <div style={{ width: `${s.lost}%`, backgroundImage: STRIPES }} />
          </div>
          <p className="text-right tabular-nums">
            <span className={s.oee ? "text-lg font-bold" : "font-medium"}>{d1(s.left)}%</span>
            {i > 0 && <span className="ml-2 text-xs text-muted-foreground">−{d1(s.lost)}%p</span>}
          </p>
        </li>
      ))}
    </ol>
  );
}

const d1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1);   // 소수 한 자리 — 0.04 같은 잔챙이는 0.0
