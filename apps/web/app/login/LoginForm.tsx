"use client";   // 🔴 1행 — 실패 쪽지 · 이메일 되살리기는 브라우저에서

// 로그인 폼 (10/27) — 틀려도 이메일은 남기고 비밀번호만 비운다
// 🔵 React 19 폼은 action 이 끝나면 칸을 defaultValue 로 되돌린다 → 이메일만 defaultValue 를 돌려받아 남고, 비밀번호는 비워진다
// 이메일을 주소(?email=)에 싣지 않는다 — 방문 기록 · 서버 로그에 남는다
import { useActionState } from "react";

import { login } from "./actions";
import { SubmitButton } from "./SubmitButton";   // 누른 뒤 "로그인 중…" — 브라우저에서 (10/26)

const INPUT =
  "h-12 w-full rounded-md border bg-white px-4 text-base outline-none transition-colors duration-150 focus:border-gray-900 motion-reduce:transition-none";

export function LoginForm() {
  const [state, formAction] = useActionState(login, null);

  return (
    // 🔴 name 이 formData.get() 과 철자가 같아야 한다. 다르면 null 이 조용히 들어간다
    <form action={formAction} className="space-y-4 rounded-xl border bg-white p-8 shadow-sm">
      <input name="email" type="email" required placeholder="이메일" defaultValue={state?.email} className={INPUT} />
      <input name="password" type="password" required placeholder="비밀번호" className={INPUT} />
      {/* 입력칸 · 버튼 36 → 48px — 크고 꽉 찬 버튼 (10/26) */}
      <SubmitButton />
      {/* 🔴 required · type="email" 은 편의일 뿐 — 진짜 검사는 서버가 한다 */}
      {/* 실패 문구는 버튼 바로 아래 — 눌렀는데 안 되면 눈은 버튼 근처를 본다 (10/26) */}
      {state && (
        <p role="alert" className="text-sm text-red-600">
          이메일 또는 비밀번호가 일치하지 않습니다.
        </p>
      )}
    </form>
  );
}
