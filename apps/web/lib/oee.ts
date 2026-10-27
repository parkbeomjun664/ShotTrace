// OEE 계산기 — 순수함수: 같은 입력 → 같은 출력 · DB · 시계 · 화면을 안 본다
export type OeeInput = {                               // 부르는 쪽이 DB 에서 모아 넣는다
  runMinutes: number;                                  // 가동시간 (분)
  lossMinutes: number;                                 // 셋업 + 계획 외 정지 (분) · 🔴 계획 정지는 넣지 않는다 — 분모에서 뺀다
  shots: number;                                       // 🔴 부품 수가 아니라 샷 수 — 패밀리 금형은 한 샷에 둘
  stdCycleSec: number;                                 // 표준 사이클타임 (초) — 약속된 값 · 잰 값이 아니다
  goodQty: number;                                     // 양품 (부품 수)
  totalQty: number;
};

export type Oee = {
  availability: number | null;
  performance: number | null;
  performanceRaw: number | null;                       // 자르기 전 — 1 을 크게 넘으면 입력을 의심한다
  quality: number | null;
  oee: number | null;
};

const ratio = (a: number, b: number) => (b > 0 ? a / b : null);   // 분모 0 → 0 이 아니라 null (계산 안 함)

export function computeOee(i: OeeInput): Oee {
  const availability = ratio(i.runMinutes, i.runMinutes + i.lossMinutes);   // 가동률
  const performanceRaw = i.stdCycleSec > 0 ? ratio((i.shots * i.stdCycleSec) / 60, i.runMinutes) : null;   // 표준이 없으면 null — 0% 가 아니라 "잴 기준이 없다" · 🔴 초 → 분 (/ 60)
  const performance = performanceRaw === null ? null : Math.min(performanceRaw, 1);   // 🔴 100% 상한 — 버그를 숨길 수 있다
  const quality = ratio(i.goodQty, i.totalQty);        // 품질
  const oee =                                          // 셋 중 하나라도 계산 못 하면 OEE 도 null
    availability === null || performance === null || quality === null
      ? null
      : availability * performance * quality;

  return { availability, performance, performanceRaw, quality, oee };
}

// ── 여러 LOT 을 하나로 (10/26) — 비율을 평균하지 않는다. 분 · 개수를 더해 다시 나눈다 (생산량 가중) ──
// 🔴 LOT 별 OEE 를 평균하면 1개짜리 LOT 과 463개짜리 LOT 이 같은 무게가 된다
export function aggregateOee(rows: OeeInput[]): Oee {
  const ok = rows.filter((r) => r.stdCycleSec > 0);   // 표준이 없는 LOT 은 성능을 잴 수 없다 — 통째로 뺀다
  const run = ok.reduce((a, r) => a + r.runMinutes, 0);
  const loss = ok.reduce((a, r) => a + r.lossMinutes, 0);
  const ideal = ok.reduce((a, r) => a + (r.shots * r.stdCycleSec) / 60, 0);   // 표준대로면 걸렸을 분 — 제품마다 표준이 달라 여기서 곱한다
  const good = ok.reduce((a, r) => a + r.goodQty, 0);
  const total = ok.reduce((a, r) => a + r.totalQty, 0);

  const availability = ratio(run, run + loss);
  const performanceRaw = ratio(ideal, run);
  const performance = performanceRaw === null ? null : Math.min(performanceRaw, 1);
  const quality = ratio(good, total);
  const oee = availability === null || performance === null || quality === null ? null : availability * performance * quality;
  return { availability, performance, performanceRaw, quality, oee };
}

// OEE 상태 — 85 이상 기본(흔히 쓰는 세계 수준) · 60 이상 주의 · 그 아래 나쁨
export type OeeLevel = "ok" | "warn" | "bad";
export function oeeLevel(v: number | null): OeeLevel | null {
  if (v === null) return null;
  if (v >= 0.85) return "ok";
  if (v >= 0.6) return "warn";
  return "bad";
}

// 손실 워터폴 — 계획 시간 100% 가 어디서 깎여 OEE 가 되나. 네 조각의 합 = 100
export function waterfall(o: Oee) {
  const a = o.availability ?? 0, p = o.performance ?? 0, q = o.quality ?? 0;
  return {
    availabilityLoss: 1 - a,                           // 멈춰서 잃은 몫
    performanceLoss: a * (1 - p),                      // 돌았지만 느려서 잃은 몫
    qualityLoss: a * p * (1 - q),                      // 만들었지만 불량이라 잃은 몫
    oee: a * p * q,
  };
}
