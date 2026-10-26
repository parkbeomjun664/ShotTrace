"use client";   // 🔴 1행 — 확인 모달을 열고 닫는 건 브라우저

// 로그아웃 — 누르면 바로 나가지 않고 한 번 묻는다 (10/27)
// <dialog> — Esc 로 닫히고, 포커스가 안에 갇히고, 뒤 화면을 막는다 (비가동 「직접 추가」와 같다)
import { useRef } from "react";
import { useFormStatus } from "react-dom";

import { logout } from "./login/actions";

export function LogoutButton() {
  const ref = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="cursor-pointer whitespace-nowrap rounded-md border border-black/15 px-3 py-1 text-black/70 transition-colors hover:border-black/30 hover:bg-black/10 hover:text-black motion-reduce:transition-none dark:border-white/20 dark:text-white/70 dark:hover:border-white/40 dark:hover:bg-white/15 dark:hover:text-white"
      >
        로그아웃
      </button>
      <dialog ref={ref} className="m-auto w-full max-w-xs whitespace-normal rounded-xl border p-6 text-left backdrop:bg-black/30">
        <h2 className="font-semibold">로그아웃하시겠습니까?</h2>
        {/* 🔴 로그아웃은 링크가 아니라 폼(POST) — 링크면 prefetch 가 미리 눌러버린다 */}
        <form action={logout} className="mt-6 flex justify-end gap-2">
          {/* autoFocus — 실수로 Enter 를 쳐도 나가지 않게 「취소」에 먼저 */}
          <button type="button" autoFocus onClick={() => ref.current?.close()} className="cursor-pointer rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
            취소
          </button>
          <Confirm />
        </form>
      </dialog>
    </>
  );
}

// 보내는 동안 잠근다 — useFormStatus 는 자기를 감싼 <form> 만 보므로 따로 뺐다
function Confirm() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="cursor-pointer rounded-md bg-black px-3 py-1.5 text-sm text-white hover:bg-black/80 disabled:opacity-50 dark:bg-white dark:text-black">
      {pending ? "로그아웃 중…" : "로그아웃"}
    </button>
  );
}
