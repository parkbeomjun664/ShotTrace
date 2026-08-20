// 현황판 — 오늘 잘 돌아가고 있나 · 설비는 살아있나 · OEE는
// 담당: M11(쿼리) → M17(실시간) → M23(OEE)
export default function Page() {
  return (
    <section>
      <h1 className="text-2xl font-bold tracking-tight">현황판</h1>
      <p className="mt-2 text-sm text-black/60 dark:text-white/60">
        오늘 잘 돌아가고 있나 · 설비는 살아있나 · OEE는 얼마인가
      </p>
      <p className="mt-8 text-sm text-black/40 dark:text-white/40">
        M11에서 수율 집계 쿼리를 붙인다.
      </p>
    </section>
  );
}
