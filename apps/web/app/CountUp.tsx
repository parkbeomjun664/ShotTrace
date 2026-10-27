"use client";   // 🔴 1행 — 숫자가 올라가는 건 브라우저에서

// 0 에서 값까지 숫자가 올라간다 (10/27) — KPI 카드 같은 "큰 숫자 하나" 에만
// 서버 HTML 에는 진짜 값이 그대로 — 자바스크립트가 없거나 움직임 줄이기면 그 값만 보인다
// 상태(useState) 대신 글자를 직접 바꾼다 — 한 프레임마다 화면 전체를 다시 그리지 않게
import { useEffect, useRef } from "react";

export function CountUp({ value, decimals = 1, suffix = "", ms = 900 }: { value: number; decimals?: number; suffix?: string; ms?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const played = useRef(false);                        // 한 번만 — 실시간 새로고침으로 값이 바뀔 때마다 0 부터 다시 오르면 정신없다
  const text = (v: number) => `${v.toFixed(decimals)}${suffix}`;

  useEffect(() => {
    const el = ref.current;
    if (!el || played.current || !window.matchMedia("(prefers-reduced-motion: no-preference)").matches) return;
    const start = performance.now();
    let id = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / ms, 1);
      el.textContent = text(value * (1 - (1 - t) ** 3));   // 처음엔 빠르게, 끝에서 천천히 (ease-out)
      if (t < 1) id = requestAnimationFrame(tick);
      else played.current = true;                        // 끝까지 간 뒤에 표시 — 개발 모드는 효과를 두 번 돌려 첫 번은 바로 취소된다
    };
    id = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(id);
      el.textContent = text(value);                      // 중간에 떠나도 진짜 값으로
    };
  }, [value, decimals, suffix, ms]);                     // eslint-disable-line react-hooks/exhaustive-deps -- text 는 이 셋으로 정해진다

  return <span ref={ref}>{text(value)}</span>;
}
