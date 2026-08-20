// 마스터 관리 — 설비·제품·불량코드. 관리자 전용
// 담당: M18(인증·RLS)
export default function Page() {
  return (
    <section>
      <h1 className="text-2xl font-bold tracking-tight">마스터 관리</h1>
      <p className="mt-2 text-sm text-black/60 dark:text-white/60">
        설비 · 제품 · 불량코드. 관리자만 수정할 수 있다.
      </p>
      <p className="mt-8 text-sm text-black/40 dark:text-white/40">
        11월 · M18에서 붙인다.
      </p>
    </section>
  );
}
