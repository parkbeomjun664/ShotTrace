// LOT 대응 가이드의 재료와 모양 — SDK 를 안 부른다. 순수함수 + 스키마 (테스트 대상)
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

// ── 출력-데이터 교차검증 (인젝션 ② · 위장 은폐 근본 방어) ────────────────────
// 🔴 모델 자체 필터는 확률적이다(하드닝이 뚫릴 수 있다). 그래서 '센 신호인데 정상이라 함' 모순을
//    데이터로 결정적으로 잡는다. 1차는 구조(|z| 큰데 원인 0개) — 표현을 바꿔도 못 숨긴다. 키워드는 보조(좁게).
const Z_STRONG = 2;                                    // 강한 신호 — '원인 0개'면 차단 (빨간불인데 원인 없음)
const Z_MID = 1.5;                                     // 중간 신호 — AI 가 '정상' 단정하면 차단 (중간 불량 은폐 틈 메움)
const NORMALCY_PHRASES = ["조치 불필요", "점검 불필요", "정상입니다"] as const;   // 불량 가이드엔 거의 안 나오는 단정 문구만

export function guideContradictsData(
  guide: Guide,
  stats: MetricStat[],
): { contradiction: boolean; reason: string } {
  const maxAbsZ = Math.max(0, ...stats.map((s) => (s.z === null ? 0 : Math.abs(s.z))));

  // 보조(중간 신호부터): |z|≥1.5 인데 "조치 불필요·정상입니다" 단정 → 은폐 의심.
  //   좁은 단정 문구만 본다. 중간 불량(1.5~1.9)의 '정상 단정' 은폐 틈을 메운다.
  if (maxAbsZ >= Z_MID) {
    const text = [guide.summary, ...guide.causes.flatMap((c) => [c.title, c.reasoning, c.check])].join(" ");
    const hit = NORMALCY_PHRASES.find((p) => text.includes(p));
    if (hit) return { contradiction: true, reason: `|z|=${maxAbsZ.toFixed(1)} 인데 "${hit}" 단정` };
  }

  // 1차(근본): 강한 신호(|z|≥2)인데 원인 0개 — 표현을 바꿔도 못 숨긴다.
  //   🔴 중간 신호(1.5~1.9)의 빈 causes 는 '판단 불가'(정상 결론)일 수 있어 제외 — 오탐 방지
  if (maxAbsZ >= Z_STRONG && guide.causes.length === 0) {
    return { contradiction: true, reason: `강한 신호(|z|=${maxAbsZ.toFixed(1)}) 인데 원인 0개` };
  }

  return { contradiction: false, reason: "" };
}

// ── 노골적 인젝션 패턴 스캔 (인젝션 ③ · 기록·경보용, 차단 아님) ──────────────
// 🔴 이건 #1(위장 은폐)을 막지 못한다 — 그건 ② 가 한다. 여기선 "무시하세요"·"OVERRIDE" 같은
//    티 나는 인젝션을 포렌식으로 남긴다. 로그 전용이라 다소 넓어도 되지만, 좁게 시작한다.
const INJECTION_MARKERS = [
  "이전 지시", "무시하세요", "무시하라", "무시해", "따르지 마", "override",
  "system 프롬프트", "시스템 프롬프트", "디버그 모드", "정상으로 써", "정상입니다 라고",
  "ignore previous", "ignore all",
] as const;

export function scanForInjection(texts: string[]): string[] {   // 매칭된 마커 목록 (없으면 [])
  const hay = texts.join(" \n ").toLowerCase();
  return INJECTION_MARKERS.filter((m) => hay.includes(m.toLowerCase()));
}
