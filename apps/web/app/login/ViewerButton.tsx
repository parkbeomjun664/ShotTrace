"use client";   // 🔴 1행 — 누르는 동안 · 실패 쪽지는 브라우저에서

// 「둘러보기로 시작」 (공개용 정리) — 계정을 몰라도 읽기 전용으로 바로 들어간다
// 비밀번호는 서버 액션(loginAsViewer)이 환경변수에서 꺼낸다 — 이 파일에는 없다
import { useActionState } from "react";

import { loginAsViewer } from "./actions";

export function ViewerButton() {
  const [state, action, pending] = useActionState(loginAsViewer, null);

  return (
    <form action={action} className="space-y-2 text-center">
      <button
        disabled={pending}
        className="h-12 w-full cursor-pointer rounded-md border bg-white text-base font-medium transition-colors duration-150 hover:bg-muted disabled:opacity-60 motion-reduce:transition-none"
      >
        {pending ? "들어가는 중…" : "둘러보기로 시작"}
      </button>
      <p className="text-sm text-muted-foreground">로그인 없이 읽기 전용 · 저장 버튼은 잠겨 있어요</p>
      {state?.failed && (
        <p role="alert" className="text-sm text-red-600">
          지금은 둘러보기를 쓸 수 없어요. 잠시 뒤 다시 시도해 주세요.
        </p>
      )}
    </form>
  );
}
