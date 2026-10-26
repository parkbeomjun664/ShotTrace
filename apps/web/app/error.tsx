"use client";   // 🔴 1행 — 다시 시도(reset)를 눌러야 해서 브라우저에서 돈다 · 모든 화면 공통 에러 (M29)

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section>
      <h1 className="text-lg font-semibold">화면을 불러오지 못했습니다</h1>
      <p className="mt-2 text-sm text-black/60 dark:text-white/60">
        잠시 뒤 다시 시도해 주세요. 계속되면 아래 번호를 관리자에게 알려주세요.
      </p>
      {/* 🔴 운영에선 Next 가 진짜 메시지를 숨긴다 — 대신 사건 번호(digest) · 로그에 같은 번호로 진짜 에러 */}
      {error.digest && <p className="mt-1 font-mono text-xs text-black/60 dark:text-white/60">{error.digest}</p>}
      <button
        onClick={reset}                                  // 그 화면만 다시 그려본다 — 새로고침보다 가볍다
        className="mt-6 rounded border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
      >
        다시 시도
      </button>
    </section>
  );
}
