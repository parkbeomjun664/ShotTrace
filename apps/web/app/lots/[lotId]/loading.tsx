// 이 파일만 두면 Next가 Suspense 껍데기를 자동으로 씌운다
// 뼈대(스켈레톤) — 실제 화면과 같은 자리에 회색 상자를 둔다. 데이터가 오면 그 자리에 그대로 채워져 화면이 덜 튄다 (10/26)
// motion-safe — 움직임 줄이기를 켠 사람에게는 깜빡이지 않는다
const BOX = "rounded-md bg-muted motion-safe:animate-pulse";

export default function Loading() {
  return (
    <section className="space-y-8" role="status" aria-label="LOT 상세 불러오는 중">
      <span className="sr-only">불러오는 중…</span>

      {/* 뒤로 · 제목 · 한 줄 설명 */}
      <div>
        <div className={`${BOX} h-4 w-20`} />
        <div className={`${BOX} mt-3 h-8 w-64`} />
        <div className={`${BOX} mt-3 h-4 w-80 max-w-full`} />
      </div>

      {/* 카드 3개 — 양품률 · 불량 · 가동 구간 */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border p-6">
            <div className={`${BOX} h-4 w-16`} />
            <div className={`${BOX} mt-4 h-8 w-24`} />
            <div className={`${BOX} mt-2 h-4 w-32`} />
          </div>
        ))}
      </div>

      {/* 작은 차트 4개 — LotCharts 와 같은 2열 · 높이 170 */}
      <div>
        <div className={`${BOX} h-5 w-32`} />
        <div className="mt-3 grid gap-x-6 gap-y-4 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i}>
              <div className={`${BOX} h-4 w-24`} />
              <div className={`${BOX} mt-2 h-[170px]`} />
            </div>
          ))}
        </div>
      </div>

      {/* 샷 이력 표 */}
      <div>
        <div className={`${BOX} h-5 w-20`} />
        <div className={`${BOX} mt-3 h-64`} />
      </div>
    </section>
  );
}
