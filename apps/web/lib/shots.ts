// LOT 상세의 샷 규칙 — 빈 구간 · 기준 범위 · 이상 샷 (10/26 · M26 테스트 대상)
// 순수함수 — DB 를 안 부른다. 차트(LotCharts)와 표(page)가 같은 판정을 쓴다
import { metricStats, type MetricKey } from "./evidence";   // 상대 경로 — Vitest 는 @/ 별칭을 모른다
import type { LotShot } from "./queries";
import { getSpecBand, MIN_TOLERANCE, type Tolerance } from "./spec";   // 범위는 한 곳에서 — 띠와 판정이 같은 값 (10/26)

export const GAP_FACTOR = 5;                           // 샷 간격이 표준 CT × 5 를 "넘으면" 빈 구간 — 숫자에 이름을 붙인다

export const CHART_METRICS = [                         // 작은 차트 4개 — 사이클 · 사출압 · 배럴1 · 금형3
  "cycle_time",
  "max_injection_pressure",
  "barrel_temperature_1",
  "mold_temperature_3",
] as const satisfies readonly MetricKey[];
export type ChartMetric = (typeof CHART_METRICS)[number];

export type Gap = { x1: number; x2: number; minutes: number };

// 빈 구간 — 이웃한 두 샷의 간격이 표준 CT × 5 를 넘는 곳. 첫 샷 앞 · 마지막 샷 뒤는 보지 않는다
export function findGaps(times: number[], stdCycleSec: number): Gap[] {
  if (!(stdCycleSec > 0)) return [];                   // 표준이 없으면 "길다" 의 기준이 없다
  const t = [...times].sort((a, b) => a - b);
  const limit = stdCycleSec * GAP_FACTOR * 1000;
  const out: Gap[] = [];
  for (let i = 1; i < t.length; i++) {
    const d = t[i] - t[i - 1];
    if (d > limit) out.push({ x1: t[i - 1], x2: t[i], minutes: Math.round(d / 60000) });   // 🔴 "넘으면" — 딱 5배는 아직 정상
  }
  return out;
}

export type Band = { lo: number; hi: number } | null;

// 기준 범위(대체) — 이 LOT 양품의 평균 ± max(3σ, 최소 허용 폭). 이전 정상 LOT · 설비 전체 기준(025)이 없을 때만 쓴다
export function bands(shots: LotShot[], tol: Tolerance = MIN_TOLERANCE): Record<ChartMetric, Band> {
  const stats = new Map(metricStats(shots).map((m) => [m.key, m]));
  return Object.fromEntries(
    CHART_METRICS.map((k) => [k, getSpecBand(k, stats.get(k)?.goodMean ?? null, stats.get(k)?.goodStd ?? null, tol)]),
  ) as Record<ChartMetric, Band>;
}

export const outOfBand = (v: number | null | undefined, b: Band) =>
  b !== null && typeof v === "number" && (v < b.lo || v > b.hi);

// 이상 샷 — 불량이거나, 네 변수 중 하나라도 기준 범위 밖
export const isAnomaly = (s: LotShot, b: Record<ChartMetric, Band>) =>
  s.pass_or_fail === "N" || CHART_METRICS.some((k) => outOfBand(s[k], b[k]));

// ── 샷 순번 축 (10/26) — x 는 1..N. 시간 축은 오래 쉰 LOT 에서 샷이 한쪽에 몰렸다 ──

export type IndexGap = { at: number; minutes: number };   // at = 두 샷 사이 (예: 12.5 = 12번과 13번 사이)

// 순번 축의 빈 구간 — findGaps 와 같은 기준(표준 CT × 5 초과). times 는 샷 순서(시간순)대로
export function indexGaps(times: number[], stdCycleSec: number): IndexGap[] {
  if (!(stdCycleSec > 0)) return [];
  const limit = stdCycleSec * GAP_FACTOR * 1000;
  const out: IndexGap[] = [];
  for (let i = 1; i < times.length; i++) {
    const d = times[i] - times[i - 1];
    if (d > limit) out.push({ at: i + 0.5, minutes: Math.round(d / 60000) });   // i 번째(1부터)와 i+1 번째 사이
  }
  return out;
}

export const gapLabel = (minutes: number) =>          // 125 → "샷 없음 2시간 5분"
  minutes >= 60 ? `샷 없음 ${Math.floor(minutes / 60)}시간 ${minutes % 60}분` : `샷 없음 ${minutes}분`;

// y 축 — 기준 범위와 데이터를 합친 폭 + 위아래 10% 여백
export function axisDomain(values: number[], band: Band): [number, number] {
  const all = [...values, ...(band ? [band.lo, band.hi] : [])];
  if (all.length === 0) return [0, 1];
  let lo = Math.min(...all), hi = Math.max(...all);
  if (hi === lo) { lo -= 1; hi += 1; }                // 값이 하나뿐이면 폭을 만든다
  const pad = (hi - lo) * 0.1;
  return [lo - pad, hi + pad];
}

export const decimalsFor = (width: number) => (width < 0.5 ? 2 : width < 5 ? 1 : 0);   // 범위가 좁을수록 자릿수를 늘린다

// 눈금 4 ~ 5개 — 1 · 2 · 5 × 10ⁿ 간격. 표시했을 때 같은 글자가 두 번 나오지 않는다
export function niceTicks([lo, hi]: [number, number]): { ticks: number[]; decimals: number } {
  const width = hi - lo;
  const raw = width / 4;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * p).find((s) => width / s <= 5) ?? 10 * p;
  const decimals = Math.max(decimalsFor(width), Math.max(0, -Math.floor(Math.log10(step))));   // 간격보다 거친 자릿수면 눈금이 겹친다
  const ticks: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) ticks.push(Number(t.toFixed(decimals)));
  return { ticks: [...new Set(ticks)], decimals };
}

// x 축 눈금 — 순번 몇 개를 고르되, 같은 시각 글자가 되면 건너뛴다 (1분에 한 샷이라 HH:mm 이 겹칠 수 있다)
export function indexTicks(labels: string[], want = 6): number[] {
  const n = labels.length;
  if (n === 0) return [];
  const step = Math.max(1, Math.round((n - 1) / (want - 1)));
  const out: number[] = [];
  const seen = new Set<string>();
  for (let i = 1; i <= n; i += step) {
    if (seen.has(labels[i - 1])) continue;
    seen.add(labels[i - 1]);
    out.push(i);
  }
  return out;
}

// x 축 눈금 글자 — 앞 눈금과 날짜가 같으면 시:분만, 바뀌면 날짜도 (10/26)
export function tickLabels(ticks: number[], dates: string[], times: string[]): Map<number, string> {
  const out = new Map<number, string>();
  let prev = "";
  for (const t of ticks) {
    const d = dates[t - 1], h = times[t - 1];
    out.set(t, prev && d === prev ? h : `${d} ${h}`);
    prev = d;
  }
  return out;
}
