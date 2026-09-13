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

export function ShotChart({ data }: { data: LotShot[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
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
          domain={["auto", "auto"]}
          tick={{ fontSize: 11, fill: "currentColor" }}
          stroke="currentColor"
          opacity={0.6}
        />
        <Tooltip
          labelFormatter={(v) => 시각(String(v))}   // ReactNode → string
          contentStyle={{ fontSize: 12, borderRadius: 6 }}
          formatter={(v) => [`${Number(v).toFixed(2)} s`, "사이클"]}
        />
        <Line
          type="monotone"
          dataKey="cycle_time"
          stroke="currentColor"
          strokeWidth={1.5}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
