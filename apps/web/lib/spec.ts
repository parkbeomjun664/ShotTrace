// 기준 범위 설정 — 변수마다 "최소 허용 폭" (10/26)
//
//   기준 범위 = 평균 ± max(3σ, 최소 허용 폭)
//   🔴 정상 LOT 의 사이클 σ 가 0.03초 남짓이라 ±3σ 가 ±0.1초 — 정상 샷 대부분이 "이상" 이 됐다 (10/27 LOT 246 / 314)
//   그래서 공정에서 의미 없는 흔들림보다 좁아지지 않게 바닥을 깐다. 값은 현장 감각의 출발점 — 바꿀 때는 여기만
import type { ChartMetric } from "./shots";

export const MIN_TOLERANCE: Record<ChartMetric, { kind: "pct" | "abs"; value: number }> = {
  cycle_time: { kind: "pct", value: 0.01 },            // 평균의 1%   — 60초면 ±0.6초
  max_injection_pressure: { kind: "pct", value: 0.02 }, // 평균의 2%  — 142 bar 면 ±2.8 bar
  barrel_temperature_1: { kind: "abs", value: 2 },     // ±2 ℃
  mold_temperature_3: { kind: "abs", value: 1 },       // ±1 ℃
};

export type SpecBand = { lo: number; hi: number } | null;

// 차트의 띠와 이탈 판정이 같은 값을 쓰도록 — 범위는 이 함수 하나에서만 만든다
export function getSpecBand(metric: ChartMetric, mean: number | null, std: number | null): SpecBand {
  if (mean === null) return null;
  const t = MIN_TOLERANCE[metric];
  const floor = t.kind === "pct" ? Math.abs(mean) * t.value : t.value;
  const half = Math.max(3 * (std ?? 0), floor);        // σ 가 0 이거나 없어도 최소 폭은 있다
  return { lo: mean - half, hi: mean + half };
}
