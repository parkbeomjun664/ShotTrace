// LOT 대응 가이드의 재료와 모양 (M25) — SDK 를 안 부른다. 순수함수 + 스키마 (M26 테스트 대상)
//
//   오픈북 = buildEvidence 가 만든 "우리 숫자" — Claude 는 이것만 본다
//   택배 상자 = GuideSchema — Claude 는 이 모양으로만 답한다
//   🔴 숫자는 Claude 의 답에 없다. 근거는 이름(metric)만 받고, 화면은 이 파일이 센 숫자를 붙인다
import { z } from "zod";

import type { LotShot } from "@/lib/queries";

export const METRICS = {                               // 근거로 고를 수 있는 공정변수 — get_lot_shots 의 컬럼
  cycle_time: "사이클 타임 (s)",
  injection_time: "사출 시간 (s)",
  max_injection_pressure: "최대 사출압 (bar)",
  max_back_pressure: "최대 배압 (bar)",
  cushion_position: "쿠션 위치 (mm)",
  barrel_temperature_1: "배럴1 온도 (℃)",
  barrel_temperature_6: "배럴6 온도 (℃)",
  mold_temperature_3: "금형3 온도 (℃)",
} as const;

export type MetricKey = keyof typeof METRICS;
const METRIC_KEYS = Object.keys(METRICS) as [MetricKey, ...MetricKey[]];   // z.enum 은 "하나 이상" 튜플을 받는다

export const GuideSchema = z.object({                  // 택배 상자 — 구조화 출력 + 저장된 jsonb 를 읽을 때 다시 검사
  summary: z.string(),                                 // 한두 문장 — 판단할 수 없으면 그렇다고
  causes: z.array(
    z.object({
      title: z.string(),                               // 의심 원인
      metric: z.enum(METRIC_KEYS),                     // 🔴 근거는 목록 중 하나 — 없는 변수는 쓸 수 없다
      reasoning: z.string(),                           // 왜 그렇게 보나 (숫자 없이)
      check: z.string(),                               // 현장에서 점검할 곳
    }),
  ),
});
export type Guide = z.infer<typeof GuideSchema>;

export type MetricStat = {
  key: MetricKey;
  label: string;
  goodMean: number | null;                             // 양품 평균
  goodStd: number | null;                              // 양품 표준편차 — 평소의 흔들림
  failMean: number | null;                             // 불량 평균
  z: number | null;                                    // (불량 평균 − 양품 평균) ÷ 양품 표준편차 — 평소 흔들림의 몇 배 벗어났나
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function std(xs: number[]) {                           // 표본 표준편차 — 둘 미만이면 흔들림을 말할 수 없다
  const m = mean(xs);
  if (m === null || xs.length < 2) return null;
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

export function metricStats(shots: LotShot[]): MetricStat[] {   // 변수마다 양품 vs 불량
  const good = shots.filter((s) => s.pass_or_fail !== "N");
  const fail = shots.filter((s) => s.pass_or_fail === "N");
  return METRIC_KEYS.map((key) => {
    const pick = (rows: LotShot[]) =>
      rows.map((s) => s[key]).filter((v): v is number => typeof v === "number");   // 🔴 null 은 빼고 센다 — 0 으로 세면 평균이 끌려 내려간다
    const g = pick(good);
    const f = pick(fail);
    const goodMean = mean(g);
    const goodStd = std(g);
    const failMean = mean(f);
    const z =
      goodMean !== null && failMean !== null && goodStd                    // goodStd 가 0 이면 나눌 수 없다 — 0 도 거짓
        ? (failMean - goodMean) / goodStd
        : null;
    return { key, label: METRICS[key], goodMean, goodStd, failMean, z };
  });
}

export type DowntimeBrief = { reason: string; minutes: number; note: string | null };

const r2 = (v: number | null) => (v === null ? null : Math.round(v * 100) / 100);   // 보낼 글을 줄인다 — 토큰 = 돈

export function defectPositions(shots: LotShot[], startedAt: string) {   // 불량이 LOT 의 어디서 났나 — "초기에 몰렸나?" 에 답한다
  const t0 = Date.parse(startedAt);
  return [...shots]
    .sort((a, b) => Date.parse(a.measured_at) - Date.parse(b.measured_at))   // 🔴 순번은 시간 순서여야 — 받은 순서를 믿지 않는다
    .map((s, i) => ({ s, shot_no: i + 1 }))            // 1부터 — 사람이 세는 방식
    .filter(({ s }) => s.pass_or_fail === "N")
    .slice(0, 30)                                      // 불량이 많아도 30개까지 — 토큰 = 돈
    .map(({ s, shot_no }) => ({
      shot_no,
      minutes_from_start: Math.round((Date.parse(s.measured_at) - t0) / 60000),
      reason: s.fail_reason,
    }));
}

export function buildEvidence(input: {                 // 오픈북 — Claude 에게 보낼 전부
  lotId: string;
  product: string;
  equipment: string;
  startedAt: string;                                   // LOT 시작 — 불량 위치의 기준
  shots: LotShot[];
  reasons: [string, number][];                         // pareto() 결과 그대로
  downtimes: DowntimeBrief[];
}) {
  const fail = input.shots.filter((s) => s.pass_or_fail === "N").length;
  return {
    lot: { lot_id: input.lotId, product: input.product, equipment: input.equipment },
    shots: { total: input.shots.length, fail },
    defect_reasons: input.reasons.map(([reason, count]) => ({ reason, count })),
    defect_positions: defectPositions(input.shots, input.startedAt),   // 몇 번째 샷 · 시작 후 몇 분
    metrics: metricStats(input.shots).map((m) => ({
      key: m.key,
      label: m.label,
      good_mean: r2(m.goodMean),
      good_std: r2(m.goodStd),
      fail_mean: r2(m.failMean),
      z: r2(m.z),
    })),
    downtimes: input.downtimes,                        // 이 LOT 시간과 겹친 비가동
  };
}
export type Evidence = ReturnType<typeof buildEvidence>;
