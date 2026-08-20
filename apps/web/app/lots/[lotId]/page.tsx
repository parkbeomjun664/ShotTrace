// LOT 추적 ★ — 이 프로젝트의 핵심 화면
// 시간 구간 조인으로 그 LOT이 돌아간 시간대의 공정변수를 불러온다
// 담당: M12(시계열) → M24(대응 제안)
export default async function Page({ params }: PageProps<"/lots/[lotId]">) {
  const { lotId } = await params;

  return (
    <section>
      <p className="font-mono text-xs tracking-widest text-black/40 dark:text-white/40">
        LOT
      </p>
      <h1 className="mt-1 font-mono text-2xl font-bold tracking-tight">
        {lotId}
      </h1>
      <p className="mt-2 text-sm text-black/60 dark:text-white/60">
        이 LOT을 만들 때 설비가 어땠나 · 불량은 언제 났나
      </p>
      <p className="mt-8 text-sm text-black/40 dark:text-white/40">
        M12에서 시간 구간 조인 + 온도·압력 시계열을 붙인다.
      </p>
    </section>
  );
}
