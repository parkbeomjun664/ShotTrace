// LOT 목록 — 최근 LOT을 훑고 하나를 고른다
// 담당: M11
export default function Page() {
  return (
    <section>
      <h1 className="text-2xl font-bold tracking-tight">LOT 목록</h1>
      <p className="mt-2 text-sm text-black/60 dark:text-white/60">
        최근 LOT 25건. 하나를 고르면 그 시간대 설비 상태를 본다.
      </p>
      <p className="mt-8 text-sm text-black/40 dark:text-white/40">
        M11에서 production_lot 조회를 붙인다.
      </p>
    </section>
  );
}
