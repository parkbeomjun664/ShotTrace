// 비가동 화면의 계산 — 구간 겹침 · 타임라인 자리 (10/26 · M26 테스트 대상)
// 순수함수 — DB 를 안 부른다. 겹침을 진짜로 막는 건 DB 의 EXCLUDE 제약(017 downtime_no_overlap)이다

type Span = { start: number; end: number };            // ms · [start, end) 반열린 구간 (ADR 006)

// 두 구간이 겹치나 — 딱 붙은 두 구간(앞의 끝 = 뒤의 시작)은 겹침이 아니다. DB 의 tstzrange && 와 같다
export const overlaps = (a: Span, b: Span) => a.start < b.end && b.start < a.end;

// 타임라인 막대 하나의 자리 — 보이는 창(window) 안의 % 로. 창 밖이면 null, 걸치면 잘라서
export function segment(window: Span, s: Span): { left: number; width: number } | null {
  const start = Math.max(window.start, s.start);
  const end = Math.min(window.end, s.end);
  if (end <= start) return null;
  const span = window.end - window.start;
  return { left: ((start - window.start) / span) * 100, width: ((end - start) / span) * 100 };
}

// 보이는 창 — 그날 LOT 들의 처음 ~ 끝에 앞뒤 30분 여백. 하루 24시간을 다 그리면 일한 몇 시간이 납작해진다
export function dayWindow(spans: Span[]): Span | null {
  if (spans.length === 0) return null;
  const pad = 30 * 60 * 1000;
  return { start: Math.min(...spans.map((s) => s.start)) - pad, end: Math.max(...spans.map((s) => s.end)) + pad };
}

// ── 10/26 마무리 ──

export const PLANNED_CANDIDATE_MIN = 240;              // 이만큼 길게 멈췄으면 계획 정지(교대 · 휴식 · 점검)일 가능성이 크다 — 따로 묶어 보여준다

export const isPlannedCandidate = (minutes: number) => minutes >= PLANNED_CANDIDATE_MIN;   // 딱 240분부터 후보

// 일괄 기록 — 체크박스 값 "설비|시작 시각" 을 풀어 낸다. 모양이 틀린 값 · 같은 값 두 번은 버린다
export function parseSelected(values: string[]): { equipCd: string; startedAt: string }[] {
  const out = new Map<string, { equipCd: string; startedAt: string }>();
  for (const v of values) {
    const [equipCd, startedAt, ...rest] = v.split("|");
    if (!equipCd || !startedAt || rest.length || Number.isNaN(Date.parse(startedAt))) continue;
    out.set(v, { equipCd, startedAt });
  }
  return [...out.values()];
}

// 타임라인 눈금 — 창 안의 정시(HH:00)마다. 서울은 UTC+9 로 시 단위가 같아 UTC 정시 = 서울 정시
export function hourTicks(window: Span): number[] {
  const h = 3600_000;
  const out: number[] = [];
  for (let t = Math.ceil(window.start / h) * h; t <= window.end; t += h) out.push(t);
  return out;
}

// "모두 기록하면" 가동률 — 미입력 정지 분을 그 LOT 의 손실로 옮겨 다시 합산한다 (가동 − m, 손실 + m)
// 🔵 OEE 는 그대로다 — 손실이 성능 칸에서 가동률 칸으로 옮겨 갈 뿐
export function withStops<T extends { runMinutes: number; lossMinutes: number }>(input: T, stopMinutes: number): T {
  const m = Math.min(stopMinutes, input.runMinutes);   // 가동보다 길게 뺄 수는 없다
  return { ...input, runMinutes: input.runMinutes - m, lossMinutes: input.lossMinutes + m };
}
