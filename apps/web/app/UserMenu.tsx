// 헤더 오른쪽 — 레이아웃이 읽은 "누구냐" 를 그리기만 한다 (M19 · 10/20)
import Link from "next/link";

import { logout } from "./login/actions";

export function UserMenu({ email }: { email?: string }) {   // 기다릴 게 없다 — async 가 빠졌다
  if (!email) {                                        // 손목밴드가 없거나 가짜 (레이아웃의 getUser 가 걸렀다)
    return (
      <Link
        href="/login"
        className="ml-auto rounded px-3 py-1.5 text-sm text-black/50 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/10"
      >
        로그인
      </Link>
    );
  }

  // 🔴 로그아웃은 링크가 아니라 폼(POST) — 링크면 prefetch 가 미리 눌러버린다
  return (
    <form action={logout} className="ml-auto flex items-center gap-3 text-sm">
      <span className="text-black/60 dark:text-white/60">{email}</span>
      <button className="rounded px-3 py-1.5 text-black/50 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/10">
        로그아웃
      </button>
    </form>
  );
}
