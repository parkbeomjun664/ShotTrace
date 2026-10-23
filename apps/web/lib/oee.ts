// OEE 계산기 — 순수함수: 같은 입력 → 같은 출력 · DB · 시계 · 화면을 안 본다 (M24)
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
