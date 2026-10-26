"use client";                                          // 🔴 맨 첫 줄 · 브라우저로 간다

// 그때 설비는 어땠나 (10/26) — 작은 차트 4개 (사이클 · 사출압 · 배럴1 · 금형3), x 축 공유 · 툴팁 동기화(syncId)
//   x 축은 샷 순번(1..N) — 시간 축은 오래 쉰 LOT 에서 샷이 한쪽에 몰렸다. 눈금 글자는 그 샷의 시각
//   샷 사이가 표준 CT × 5 를 넘는 곳 = 세로 점선 "샷 없음 Xh Ym"
//   연한 띠 = 기준 범위(이전 정상 LOT · 없으면 설비 전체 양품 평균 ± 3σ) · 범위 밖 점 = 빨강 · 불량 샷 = 빨간 마름모
//   판정 · 축 계산은 lib/shots.ts — 표와 같은 규칙

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { CHART_METRICS, axisDomain, gapLabel, indexTicks, niceTicks, outOfBand, tickLabels, type Band, type ChartMetric, type IndexGap } from "@/lib/shots";

export type ChartRow = { n: number; time: string; date: string; hm: string; fail: boolean } & Record<ChartMetric, number | null>;   // time = 툴팁용 시각 · date · hm = 눈금 글자 재료

const LABEL: Record<ChartMetric, string> = {
  cycle_time: "사이클 타임 (s)",
  max_injection_pressure: "최대 사출압 (bar)",
  barrel_temperature_1: "배럴1 온도 (℃)",
  mold_temperature_3: "금형3 온도 (℃)",
};
const AXIS = { fontSize: 11, fill: "currentColor" };

export function LotCharts({
  rows,
  gaps,
  bands,
  stdCycleSec,
}: {
  rows: ChartRow[];
  gaps: IndexGap[];
  bands: Record<ChartMetric, Band>;
  stdCycleSec: number | null;
}) {
  if (rows.length === 0) {                             // 빈 상태 — 차트를 안 만든다
    return <p className="py-8 text-center text-sm text-muted-foreground">이 구간에 샷이 없습니다</p>;
  }

  const [hovered, setHovered] = useState<ChartMetric | null>(null);   // 값 상자는 마우스를 올린 차트에만 — 세로 기준선은 네 차트 모두 (syncId)
  const xTicks = indexTicks(rows.map((r) => `${r.date} ${r.hm}`));   // 같은 시각 글자는 한 번만
  const xLabel = tickLabels(xTicks, rows.map((r) => r.date), rows.map((r) => r.hm));   // 앞 눈금과 날짜가 같으면 시:분만
  const few = rows.length <= 30;                       // 샷이 적으면 정상 점도 찍는다 — 1샷 LOT 은 점이 없으면 안 보인다

  return (
    <div className="grid gap-x-6 gap-y-4 lg:grid-cols-2">
      {CHART_METRICS.map((k) => {
        const b = bands[k];
        const values = rows.map((r) => r[k]).filter((v): v is number => v !== null);
        const std = k === "cycle_time" && stdCycleSec ? [stdCycleSec] : [];   // 표준 CT 선도 축 안에 들어오게
        const domain = axisDomain([...values, ...std], b);   // 기준 범위 ∪ 데이터 + 10% 여백
        const { ticks, decimals } = niceTicks(domain);   // 4 ~ 5개 · 자릿수 자동 · 겹치는 글자 없음
        return (
          <div key={k}>
            <p className="text-xs text-muted-foreground">{LABEL[k]}</p>
            <ResponsiveContainer width="100%" height={170}>
              <LineChart
                data={rows}
                syncId="lot"
                margin={{ top: 16, right: 8, bottom: 0, left: -8 }}
                onMouseEnter={() => setHovered(k)}
                onMouseLeave={() => setHovered(null)}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} vertical={false} />
                <XAxis
                  dataKey="n"
                  type="number"
                  domain={[1, rows.length]}
                  ticks={xTicks}
                  tickFormatter={(n) => xLabel.get(Number(n)) ?? ""}
                  tick={AXIS}
                  stroke="currentColor"
                  opacity={0.8}
                  allowDecimals={false}
                />
                <YAxis
                  domain={domain}
                  ticks={ticks}
                  tickFormatter={(v) => Number(v).toFixed(decimals)}
                  tick={AXIS}
                  stroke="currentColor"
                  opacity={0.8}
                  width={48}
                />
                {b && <ReferenceArea y1={b.lo} y2={b.hi} fill="#d1fae5" fillOpacity={0.35} />}
                {gaps.map((g) => (
                  <ReferenceLine
                    key={g.at}
                    x={g.at}
                    stroke="currentColor"
                    strokeDasharray="3 3"
                    opacity={0.5}
                    label={k === "cycle_time" ? { value: gapLabel(g.minutes), position: "top", fontSize: 10, fill: "currentColor" } : undefined}   // 글자는 첫 차트에만 — 넷 다 쓰면 시끄럽다
                  />
                ))}
                {k === "cycle_time" && stdCycleSec && (
                  <ReferenceLine y={stdCycleSec} stroke="currentColor" strokeDasharray="4 4" opacity={0.5} label={{ value: "표준 CT", position: "insideTopRight", fontSize: 10, fill: "currentColor" }} />
                )}
                <Tooltip
                  // 🔵 다른 차트는 기준선(cursor)만 — 값 상자까지 넷이 뜨면 화면이 시끄럽다 (10/26)
                  {...(hovered !== k && { content: () => null })}
                  contentStyle={{ fontSize: 12, borderRadius: 6 }}
                  labelFormatter={(n) => {             // 툴팁 — 샷 번호 · 실제 시각
                    const r = rows[Number(n) - 1];
                    return r ? `#${r.n} · ${r.time}${r.fail ? " · 불량" : ""}` : "";
                  }}
                  formatter={(v) => [v === null ? "—" : Number(v).toFixed(Math.max(decimals, 1)), LABEL[k]]}
                />
                <Line
                  dataKey={k}
                  type="linear"                        // monotone 은 점 사이를 부풀려 없는 값을 그린다
                  stroke="currentColor"
                  strokeWidth={1.2}
                  isAnimationActive={false}
                  dot={({ cx, cy, payload, index }) => {
                    const r = payload as ChartRow;
                    if (r[k] === null || cx === undefined || cy === undefined) return <g key={index} />;
                    if (r.fail)                        // 불량 샷 — 빨간 마름모 (색 + 모양)
                      return <path key={index} d={`M${cx} ${cy - 5}L${cx + 5} ${cy}L${cx} ${cy + 5}L${cx - 5} ${cy}Z`} fill="none" stroke="var(--status-bad)" strokeWidth={1.5} />;
                    if (outOfBand(r[k], b)) return <circle key={index} cx={cx} cy={cy} r={3} fill="var(--status-bad)" />;   // 범위 밖
                    return few ? <circle key={index} cx={cx} cy={cy} r={2.5} fill="currentColor" /> : <g key={index} />;
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        );
      })}
    </div>
  );
}
