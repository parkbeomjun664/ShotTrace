// 시각 표시를 한곳에 모은다 — ADR 002 가 요구한 "포맷 함수 한 곳으로"
//
// 저장은 UTC(`timestamptz`), 표시는 KST.
// 🔴 ISO 문자열을 slice 로 잘라 쓰지 않는다. 9시간이 조용히 어긋난다.
//    실제로 한 번 어겼다 — 주간 근무(08:25~16:36)가 야간(23:25~07:36)처럼 보였다.
const KST = "Asia/Seoul";

const fmt = (o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("ko-KR", { timeZone: KST, hour12: false, ...o });

const 시분초 = fmt({ hour: "2-digit", minute: "2-digit", second: "2-digit" });
const 월일 = fmt({ month: "2-digit", day: "2-digit" });

export const 시각 = (iso: string) => 시분초.format(new Date(iso));
export const 날짜 = (iso: string) => 월일.format(new Date(iso));

/** 두 시각이 KST 기준 같은 날인가 — 자정을 넘긴 LOT 판별용 */
export const 같은날 = (a: string, b: string) => 날짜(a) === 날짜(b);

/** 구간 길이(분) */
export const 분길이 = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / 60000);

export const 소수 = (v: number | null | undefined, n = 1) =>
  v == null ? "—" : v.toFixed(n);
