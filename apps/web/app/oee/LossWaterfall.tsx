"use client";                                          // 🔴 맨 첫 줄 · 브라우저로 간다

// 손실 워터폴 (10/26) — 계획 시간 100% 가 가동 · 성능 · 품질 손실로 깎여 OEE 가 된다
// 쌓은 막대: 아래는 투명한 "받침"(base), 위가 보이는 몫(value). 손실은 회색, OEE 는 primary
// 계산은 lib/oee.ts 의 waterfall() — 여기는 그리기만

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from "recharts";

type Step = { name: string; base: number; value: number; kind: "plan" | "loss" | "oee"; text?: string };

const FILL = { plan: "#d1d5db", loss: "#9ca3af", oee: "var(--primary)" } as const;   // 계획 = 연회색 · 손실 = 회색

export function LossWaterfall({ a, p, q }: { a: number; p: number; q: number }) {   // 퍼센트(0 ~ 100) 로 받는다
  const aLoss = 100 - a;
  const pLoss = a - p;                                  // a, p, q 는 누적값 — 가동 후 남은 몫 · 성능 후 · 품질 후(= OEE)
  const qLoss = p - q;
  const steps: Step[] = [
    { name: "계획 시간", base: 0, value: 100, kind: "plan" },
    { name: "가동 손실", base: a, value: aLoss, kind: "loss" },
    { name: "성능 손실", base: p, value: pLoss, kind: "loss" },
    { name: "품질 손실", base: q, value: qLoss, kind: "loss" },
    { name: "OEE", base: 0, value: q, kind: "oee" },
  ];
  const data: Step[] = steps.map((d) => ({
    ...d,
    text: `${d1(d.value)}%`,                          // 라벨은 진짜 값에서
    value: Math.max(d.value, 0.001),                  // 🔴 높이 0 인 막대는 Recharts 가 아예 안 그린다 → 라벨도 없다. 안 보이는 만큼만 세운다
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 20, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.15} vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: "currentColor" }} stroke="currentColor" opacity={0.6} />
        <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12, fill: "currentColor" }} stroke="currentColor" opacity={0.6} />
        <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
        <Bar dataKey="value" stackId="w" maxBarSize={72} radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.name} fill={FILL[d.kind]} />
          ))}
          <LabelList dataKey="text" position="top" fontSize={12} fill="currentColor" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

const d1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1);   // 소수 한 자리 — 0.04 같은 잔챙이는 0.0
