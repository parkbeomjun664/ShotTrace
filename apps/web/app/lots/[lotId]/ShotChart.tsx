"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { 시각 } from "@/lib/format";
import type { LotShot } from "@/lib/queries";

// 사이클 타임 시계열 + 불량 지점 (M12)
export function ShotChart({ data }: { data: LotShot[] }) {
  if (data.length === 0) {                             // 빈 상태 — 차트를 안 만든다
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        이 구간에 샷이 없습니다
      </p>
    );
  }

  const rows = data.map((d) => ({                      // 파생 필드 — 원본은 안 건드림
    ...d,
    defect: d.pass_or_fail === "N" ? d.cycle_time : null,   // null 은 안 그려진다
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.15} />
        <XAxis
          dataKey="measured_at"
          tickFormatter={시각}
          minTickGap={40}
          tick={{ fontSize: 11, fill: "currentColor" }}
          stroke="currentColor"
          opacity={0.6}
        />
        <YAxis
          domain={["auto", "auto"]}                  // 🔴 기본값 0부터면 변동이 안 보임
          tick={{ fontSize: 11, fill: "currentColor" }}
          stroke="currentColor"
          opacity={0.6}
        />
        <Tooltip
          labelFormatter={(v) => 시각(String(v))}
          contentStyle={{ fontSize: 12, borderRadius: 6 }}
          formatter={(v) => [`${Number(v).toFixed(2)} s`, "사이클"]}
        />
        <Line
          type="monotone"
          dataKey="cycle_time"
          stroke="currentColor"
          strokeWidth={1.5}
          dot={rows.length <= 30}                    // 1샷 LOT 은 점이 없으면 안 보인다
        />
        <Line
          dataKey="defect"                           // 불량 지점만 (선 없이 점만)
          strokeWidth={0}
          dot={{ r: 3.5, fill: "#dc2626" }}          // 범례는 page.tsx 에 (색+글자)
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
