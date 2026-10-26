"use client";

// error.tsx 는 반드시 클라이언트 컴포넌트여야 한다.
// 에러를 잡아 다시 그려야 하므로 브라우저에서 동작해야 하기 때문.
import Link from "next/link";

import { Notice, PRIMARY, SECONDARY } from "../../Notice";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    // error.message 는 운영에서 Next 가 가린다 — 공통 화면처럼 사건 번호만 보인다 (10/27)
    <Notice
      tag="오류"
      title="LOT을 불러오지 못했어요"
      digest={error.digest}
      actions={
        <>
          <button onClick={reset} className={PRIMARY}>
            다시 시도
          </button>
          <Link href="/lots" className={SECONDARY}>
            LOT 목록으로
          </Link>
        </>
      }
    >
      샷 데이터를 가져오다 멈췄어요. 잠시 뒤 다시 시도해 주세요.
    </Notice>
  );
}
