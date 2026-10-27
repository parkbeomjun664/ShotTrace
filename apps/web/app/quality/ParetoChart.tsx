"use client";                                          // 🔴 맨 첫 줄 · 브라우저로 간다

// 파레토 (10/26) — 막대(건수, 많은 순) + 누적 % 선(오른쪽 축) + 80% 점선. 품질관리 7가지 도구의 그 모양
// 계산은 lib/quality.ts 의 pareto() 가 — 여기는 그리기만
// 10/27 — 막대를 누르면 그 유형이 난 LOT 목록으로 (/lots?reason=가스). 키보드 · 화면 읽기는 옆 표의 링크가 같은 일을 한다

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useRouter } from "next/navigation";

import type { ParetoRow } from "@/lib/quality";
import { useMotion } from "@/app/useMotion";

const AXIS = { fontSize: 12, fill: "currentColor" };

export function ParetoChart({ data }: { data: ParetoRow[] }) {   // 데이터는 props 로
  const motion = useMotion();                          // 움직임 줄이기면 그리기 애니메이션 끔 (10/27)
  const router = useRouter();
  const open = (reason: string) => { if (reason !== "사유 없음") router.push(`/lots?reason=${encodeURIComponent(reason)}`); };
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 20, right: 0, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.15} vertical={false} />
        <XAxis dataKey="reason" tick={AXIS} stroke="currentColor" opacity={0.8} />
        <YAxis yAxisId="count" tick={AXIS} stroke="currentColor" opacity={0.8} allowDecimals={false} />
        <YAxis
          yAxisId="cum"
          orientation="right"
          domain={[0, 100]}
          ticks={[0, 20, 40, 60, 80, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={AXIS}
          stroke="currentColor"
          opacity={0.8}
        />
        {/* 80% 선 — 이 선을 처음 넘는 데까지가 "먼저 손볼 유형" (파레토 법칙) */}
        <ReferenceLine yAxisId="cum" y={80} stroke="currentColor" strokeDasharray="4 4" opacity={0.5} />
        <Tooltip
          cursor={{ fill: "currentColor", opacity: 0.06 }}
          contentStyle={{ fontSize: 12, borderRadius: 6 }}
          content={({ active, payload }) => {        // 건수 · 비율 · 누적 % 를 한 상자에
            if (!active || !payload?.length) return null;
            const r = payload[0].payload as ParetoRow;
            return (
              <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-sm">
                <p className="font-medium">{r.reason}</p>
                <p className="tabular-nums">{r.count}건 · {r.share.toFixed(1)}% · 누적 {r.cum.toFixed(1)}%</p>
              </div>
            );
          }}
        />
        <Bar
          yAxisId="count"
          dataKey="count"
          fill="var(--primary)"
          maxBarSize={72}
          radius={[4, 4, 0, 0]}
          isAnimationActive={motion}
          cursor="pointer"                             // 누를 수 있다는 표시
          onClick={(d) => open((d.payload as ParetoRow).reason)}
        >
          <LabelList dataKey="count" position="top" fontSize={12} fill="currentColor" />
        </Bar>
        <Line
          yAxisId="cum"
          dataKey="cum"
          type="linear"
          stroke="#6b7280"                             // 중립 회색(gray-500) — 상태 색(주의 · 나쁨)은 수율 경고에만 쓴다 (10/26)
          strokeWidth={2}
          dot={{ r: 3, fill: "#6b7280" }}
          isAnimationActive={motion}
          animationBegin={400}                         // 막대가 선 뒤에 — 막대 다음 누적선 (10/27)
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
