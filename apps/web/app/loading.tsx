// 모든 화면 공통 로딩 — 더 깊은 곳에 loading.tsx 가 있으면 그게 먼저 (가장 가까운 것이 이긴다 · M07 · M29)
export default function Loading() {
  return <p className="text-sm text-black/60 dark:text-white/60">불러오는 중…</p>;   // /40 은 너무 연하다 — 대비 4.5 : 1
}
