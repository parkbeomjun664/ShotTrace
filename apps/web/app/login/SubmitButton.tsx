"use client";   // 🔴 1행 — "보내는 중인가" 는 브라우저만 안다

import { useFormStatus } from "react-dom";

// 로그인 버튼 — 보내는 동안 잠그고 스피너 (10/26)
// 🔵 useFormStatus 는 자기를 감싼 <form> 의 상태만 본다 — 그래서 버튼을 따로 뺐다 (page 는 서버 컴포넌트)
export function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      disabled={pending}                               // 두 번 누르지 않게
      className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-black text-base font-medium text-white transition-colors duration-150 hover:bg-black/80 disabled:bg-black/60 motion-reduce:transition-none dark:bg-white dark:text-black"
    >
      {pending && (
        <svg aria-hidden className="size-4 animate-spin motion-reduce:animate-none" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )}
      {pending ? "로그인 중…" : "로그인"}
    </button>
  );
}
