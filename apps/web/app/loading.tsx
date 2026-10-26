// 모든 화면 공통 로딩 — 더 깊은 곳에 loading.tsx 가 있으면 그게 먼저 (가장 가까운 것이 이긴다 · M07 · M29)
// 뼈대(스켈레톤) — 화면마다 모양이 달라서 공통 틀만: 제목 · 구분선 · 카드 줄 · 본문 상자 (10/26)
// motion-safe — 움직임 줄이기를 켠 사람에게는 깜빡이지 않는다
const BOX = "rounded-md bg-muted motion-safe:animate-pulse";

export default function Loading() {
  return (
    <section className="space-y-6" role="status" aria-label="불러오는 중">
      <span className="sr-only">불러오는 중…</span>
      <div className="border-b pb-4">
        <div className={`${BOX} h-8 w-40`} />
        <div className={`${BOX} mt-3 h-4 w-72 max-w-full`} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`${BOX} h-28`} />
        ))}
      </div>
      <div className={`${BOX} h-72`} />
    </section>
  );
}
