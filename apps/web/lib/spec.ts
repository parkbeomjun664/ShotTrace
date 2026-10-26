// 기준 범위 설정 — 변수마다 "최소 허용 폭" (10/26)
//   🔵 028 부터 값은 DB(parameter_spec)에 있고 admin 이 마스터 화면에서 바꾼다. 아래 상수는 그 표가 비었을 때의 기본값 · 테스트용
//
//   기준 범위 = 평균 ± max(3σ, 최소 허용 폭)
//   🔴 정상 LOT 의 사이클 σ 가 0.03초 남짓이라 ±3σ 가 ±0.1초 — 정상 샷 대부분이 "이상" 이 됐다 (10/27 LOT 246 / 314)
//   그래서 공정에서 의미 없는 흔들림보다 좁아지지 않게 바닥을 깐다. 값은 현장 감각의 출발점 — 바꿀 때는 여기만
import type { ChartMetric } from "./shots";

export type Tolerance = Record<ChartMetric, { kind: "pct" | "abs"; value: number }>;

export const MIN_TOLERANCE: Tolerance = {
  cycle_time: { kind: "pct", value: 0.01 },            // 평균의 1%   — 60초면 ±0.6초
  max_injection_pressure: { kind: "pct", value: 0.02 }, // 평균의 2%  — 142 bar 면 ±2.8 bar
  barrel_temperature_1: { kind: "abs", value: 2 },     // ±2 ℃
  mold_temperature_3: { kind: "abs", value: 1 },       // ±1 ℃
};

export type SpecBand = { lo: number; hi: number } | null;

// 차트의 띠와 이탈 판정이 같은 값을 쓰도록 — 범위는 이 함수 하나에서만 만든다
export function getSpecBand(metric: ChartMetric, mean: number | null, std: number | null, tol: Tolerance = MIN_TOLERANCE): SpecBand {
  if (mean === null) return null;
  const t = tol[metric];
  const floor = t.kind === "pct" ? Math.abs(mean) * t.value : t.value;
  const half = Math.max(3 * (std ?? 0), floor);        // σ 가 0 이거나 없어도 최소 폭은 있다
  return { lo: mean - half, hi: mean + half };
}

// DB 의 parameter_spec 줄 → 허용 폭. 모르는 변수 · 틀린 값은 버리고, 빠진 변수는 기본값으로 (028)
export function toleranceFrom(rows: { metric: string; kind: string; value: number }[]): Tolerance {
  const out: Tolerance = { ...MIN_TOLERANCE };
  for (const r of rows) {
    if (!(r.metric in out) || (r.kind !== "pct" && r.kind !== "abs") || !(r.value > 0)) continue;
    out[r.metric as ChartMetric] = { kind: r.kind, value: Number(r.value) };
  }
  return out;
}
