// 실적 입력 — 작업자가 생산·불량 수량을 기록한다
// 수정 불가. 취소 후 재등록만 가능하다 (제조 기록은 감사 대상)
// 담당: M19(폼·검증) → M20(트랜잭션)
export default function Page() {
  return (
    <section>
      <h1 className="text-2xl font-bold tracking-tight">실적 입력</h1>
      <p className="mt-2 text-sm text-black/60 dark:text-white/60">
        작업자가 생산·불량 수량을 기록한다. 수정은 불가하고 취소 후 재등록만
        가능하다.
      </p>
      <p className="mt-8 text-sm text-black/40 dark:text-white/40">
        11월 · M19에서 붙인다.
      </p>
    </section>
  );
}
