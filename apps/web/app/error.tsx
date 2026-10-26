"use client";   // 🔴 1행 — 다시 시도(reset)를 눌러야 해서 브라우저에서 돈다 · 모든 화면 공통 에러 (M29)

import { HomeLink, Notice, PRIMARY } from "./Notice";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    // 🔴 운영에선 Next 가 진짜 메시지를 숨긴다 — 대신 사건 번호(digest) · 로그에 같은 번호로 진짜 에러
    <Notice
      tag="오류"
      title="화면을 불러오지 못했어요"
      digest={error.digest}
      actions={
        <>
          {/* 그 화면만 다시 그려본다 — 새로고침보다 가볍다 */}
          <button onClick={reset} className={PRIMARY}>
            다시 시도
          </button>
          <HomeLink />
        </>
      }
    >
      잠시 뒤 다시 시도해 주세요. 계속되면 아래 사건 번호를 관리자에게 알려 주세요.
    </Notice>
  );
}
