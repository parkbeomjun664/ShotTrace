"use client";                                          // 🔴 맨 첫 줄 · 브라우저로 간다

// 일별 수율 (10/26) — 선 + 95% 목표선 · 기준 미달 점은 주의(호박) · 나쁨(빨강)
// 기준은 LOT 목록과 같다 (lib/lots.ts 의 yieldLevel · 95 / 90) — 화면끼리 판정이 같아야 한다

import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { 날짜 } from "@/lib/format";
import { yieldLevel } from "@/lib/lots";
import type { DayPoint } from "@/lib/quality";
import { useMotion } from "@/app/useMotion";

const AXIS = { fontSize: 12, fill: "currentColor" };
const DOT = { ok: "currentColor", warn: "var(--status-warn)", bad: "var(--status-bad)" } as const;

const HALF_DAY = 12 * 60 * 60 * 1000;

function gaps(data: DayPoint[]) {                      // 생산 없는 날이 이어진 구간 — 반나절씩 넓혀 하루짜리도 띠가 보이게
  const out: { x1: number; x2: number }[] = [];
  for (const d of data) {
    if (d.yield !== null) continue;
    const last = out.at(-1);
    if (last && d.ts - HALF_DAY <= last.x2) last.x2 = d.ts + HALF_DAY;
    else out.push({ x1: d.ts - HALF_DAY, x2: d.ts + HALF_DAY });
  }
  return out;
}

// 🔵 x 축은 숫자(시각) — 실제 날짜 간격대로 놓인다 (10/26)
// 선은 잇고, 생산 없는 날은 연회색 띠로 — 쉰 날이 보이면서 선은 읽기 쉽다
export function DailyYieldChart({ data }: { data: DayPoint[] }) {
  const motion = useMotion();                          // 움직임 줄이기면 그리기 애니메이션 끔 (10/27)
  const ticks = data.filter((d) => d.yield !== null).map((d) => d.ts);   // 눈금은 생산한 날에만
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.15} vertical={false} />
        <XAxis
          dataKey="ts"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          ticks={ticks}
          tickFormatter={(t) => 날짜(new Date(t).toISOString())}   // 10. 16. — 표시 형식은 한 곳에서 (ADR 002)
          tick={AXIS}
          stroke="currentColor"
          opacity={0.8}
        />
        <YAxis
          domain={[85, 100]}                           // 🔴 0 부터 그리면 90 ~ 100 의 차이가 납작해진다
          allowDataOverflow                            // 85 아래 날이 생기면 위로 잘라 그린다 (축이 출렁이지 않게)
          ticks={[85, 90, 95, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={AXIS}
          stroke="currentColor"
          opacity={0.8}
        />
        {gaps(data).map((g) => (
          <ReferenceArea
            key={g.x1}
            x1={g.x1}
            x2={g.x2}
            fill="#e5e7eb"
            fillOpacity={0.4}
            label={{ value: "생산 없음", position: "insideBottom", fontSize: 10, fill: "currentColor", opacity: 0.6 }}
          />
        ))}
        <ReferenceLine y={95} stroke="currentColor" strokeDasharray="4 4" opacity={0.5} label={{ value: "목표 95%", position: "insideTopRight", fontSize: 11, fill: "currentColor" }} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 6 }}
          formatter={(v) => [`${Number(v).toFixed(2)}%`, "수율"]}
          labelFormatter={(_, p) => (p?.[0]?.payload as DayPoint | undefined)?.date ?? ""}
        />
        <Line
          dataKey="yield"
          type="linear"
          stroke="currentColor"
          strokeWidth={1.5}
          connectNulls                                 // 빈 날은 건너 잇는다 — 쉰 날은 뒤의 연회색 띠가 보여준다
          isAnimationActive={motion}                   // 왼쪽에서 오른쪽으로 그려진다 · 움직임 줄이기면 끔 (10/27)
          animationDuration={1000}
          dot={({ cx, cy, payload, index }) => {     // 기준 미달 점만 색 — 정상은 글자색
            const y = (payload as DayPoint).yield;
            if (y === null) return <g key={index} />;   // 빈 날엔 점도 없다
            const lv = yieldLevel(y) ?? "ok";
            return <circle key={index} cx={cx} cy={cy} r={lv === "ok" ? 3 : 4.5} fill={DOT[lv]} />;
          }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
