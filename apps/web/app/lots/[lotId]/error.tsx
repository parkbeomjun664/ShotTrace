"use client";

// error.tsx 는 반드시 클라이언트 컴포넌트여야 한다.
// 에러를 잡아 다시 그려야 하므로 브라우저에서 동작해야 하기 때문.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section>
      <h1 className="text-lg font-semibold">LOT을 불러오지 못했습니다</h1>
      <p className="mt-2 font-mono text-sm text-black/50 dark:text-white/50">
        {error.message}
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
      >
        다시 시도
      </button>
    </section>
  );
}
