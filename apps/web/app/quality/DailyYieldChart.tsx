"use client";                                          // 🔴 맨 첫 줄 · 브라우저로 간다

// 일별 수율 (10/26) — 선 + 95% 목표선 · 기준 미달 점은 주의(주황) · 나쁨(빨강)
// 기준은 LOT 목록과 같다 (lib/lots.ts 의 yieldLevel · 95 / 90) — 화면끼리 판정이 같아야 한다

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { yieldLevel } from "@/lib/lots";

const AXIS = { fontSize: 12, fill: "currentColor" };
const DOT = { ok: "currentColor", warn: "var(--status-warn)", bad: "var(--status-bad)" } as const;

export type DailyPoint = { date: string; label: string; yield: number };   // label = 11. 04. (축에 짧게)

export function DailyYieldChart({ data }: { data: DailyPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.15} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} stroke="currentColor" opacity={0.6} />
        <YAxis
          domain={[85, 100]}                           // 🔴 0 부터 그리면 90 ~ 100 의 차이가 납작해진다
          allowDataOverflow                            // 85 아래 날이 생기면 위로 잘라 그린다 (축이 출렁이지 않게)
          ticks={[85, 90, 95, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={AXIS}
          stroke="currentColor"
          opacity={0.6}
        />
        <ReferenceLine y={95} stroke="currentColor" strokeDasharray="4 4" opacity={0.5} label={{ value: "목표 95%", position: "insideTopRight", fontSize: 11, fill: "currentColor" }} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 6 }}
          formatter={(v) => [`${Number(v).toFixed(2)}%`, "수율"]}
          labelFormatter={(_, p) => (p?.[0]?.payload as DailyPoint | undefined)?.date ?? ""}
        />
        <Line
          dataKey="yield"
          type="linear"
          stroke="currentColor"
          strokeWidth={1.5}
          isAnimationActive={false}
          dot={({ cx, cy, payload, index }) => {     // 기준 미달 점만 색 — 정상은 글자색
            const lv = yieldLevel((payload as DailyPoint).yield) ?? "ok";
            return <circle key={index} cx={cx} cy={cy} r={lv === "ok" ? 3 : 4.5} fill={DOT[lv]} />;
          }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
