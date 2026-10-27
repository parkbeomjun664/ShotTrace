"use client";   // 🔴 1행 — 사용자 설정(움직임 줄이기)은 브라우저만 안다

// 움직여도 되나 (10/27) — 차트 애니메이션 · 숫자 올라가기가 이걸 보고 켠다
// 서버 · 첫 그림에서는 false — 서버 HTML 과 첫 브라우저 그림이 같아야 한다 (하이드레이션)
import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: no-preference)";
const subscribe = (cb: () => void) => {
  const m = window.matchMedia(QUERY);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

export function useMotion() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}
