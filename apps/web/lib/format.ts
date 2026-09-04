// 표시 형식을 한곳에 모은다 — ADR 002 가 요구한 "포맷 함수 한 곳으로"
// 저장은 UTC(timestamptz), 표시는 KST
const KST = "Asia/Seoul";

const fmt = (o: Intl.DateTimeFormatOptions) =>         // 포맷터 만드는 공장
  new Intl.DateTimeFormat("ko-KR", {                   // 만드는 게 비싸다
    timeZone: KST,                                     // 🔴 이게 없으면 서버 시간대
    hour12: false,                                     // 오후 2시 X, 14시 O
    ...o,                                              // 나머지 옵션을 얹는다
  });

const 시분초 = fmt({ hour: "2-digit", minute: "2-digit", second: "2-digit" });
const 월일 = fmt({ month: "2-digit", day: "2-digit" }); // 모듈 로드 때 한 번만 만든다

export const 시각 = (iso: string) => 시분초.format(new Date(iso));   // 14:05:25
export const 날짜 = (iso: string) => 월일.format(new Date(iso));     // 11. 04.
// 🔴 iso.slice(11,19) 로 자르지 않는다 — UTC 가 그대로 나온다
//    한 번 어겼다: 주간(08:25~16:36)이 야간(23:25~07:36)처럼 보였다

export const 같은날 = (a: string, b: string) => 날짜(a) === 날짜(b); // 자정 넘김 판별

export const 분길이 = (from: string, to: string) =>    // 구간 길이(분)
  Math.round((Date.parse(to) - Date.parse(from)) / 60000);  // ms → 분

export const 소수 = (v: number | null | undefined, n = 1) =>  // n 생략하면 1
  v == null ? "—" : v.toFixed(n);                      // == 는 null·undefined 둘 다
