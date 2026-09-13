"use client";                                          // 🔴 맨 첫 줄 · 브라우저로 간다

import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import type { DefectRow} from "@/lib/queries";         // 서버가 주는 모양 그대로

export function ParetoChart({ data }: { data: DefectRow[] }) {   // 데이터는 props 로
    return(
        <ResponsiveContainer width="100%" height={200}>     {/* 브라우저가 크기를 잰다 */}
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>  {/* left 음수 = Y축 여백 당김 */}
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.15} />
                <XAxis 
                    dataKey="fail_reason"                     // 🔴 오타를 타입이 안 잡는다
                    tick={{ fontSize: 12, fill: "currentColor" }}
                    stroke="currentColor"
                    opacity={0.6}
                    />
                 <YAxis
                    tick={{ fontSize: 12, fill: "currentColor" }}
                    stroke="currentColor"
                    opacity={0.6}
                    />
                <Tooltip
                    cursor={{ fill: "currentColor", opacity: 0.06 }}
                    contentStyle={{ fontSize: 12, borderRadius: 6 }}
                    formatter={(v) => [`${v}건`, "불량"]}
                />
                <Bar dataKey="fail_qty" fill="currentColor" radius={[4, 4, 0, 0]} />
                {/* currentColor = 글자색 물려받음 → 다크모드 자동 대응 */}

            </BarChart>
        </ResponsiveContainer>
    )
}