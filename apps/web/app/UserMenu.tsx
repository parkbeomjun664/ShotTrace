// 헤더 오른쪽 — 레이아웃이 읽은 "누구냐" 를 그리기만 한다 (M19 · 10/20)
import Link from "next/link";

import { logout } from "./login/actions";

export function UserMenu({ email }: { email?: string }) {   // 기다릴 게 없다 — async 가 빠졌다
  if (!email) {                                        // 손목밴드가 없거나 가짜 (레이아웃의 getUser 가 걸렀다)
    return (
      <Link
        href="/login"
        className="ml-auto rounded px-3 py-1.5 text-sm text-black/70 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/10"
      >
        로그인
      </Link>
    );
  }

  // 🔴 로그아웃은 링크가 아니라 폼(POST) — 링크면 prefetch 가 미리 눌러버린다
  // 10/26 다듬기 — 첫 글자 동그라미 + 이메일, 세로 선, 테두리 있는 작은 버튼
  return (
    <form action={logout} className="flex shrink-0 items-center gap-3 text-sm">
      <span className="flex items-center gap-2">
        <span
          aria-hidden
          className="flex size-7 items-center justify-center rounded-full bg-black/80 text-xs font-semibold uppercase text-white dark:bg-white/80 dark:text-black"
        >
          {email[0]}
        </span>
        {/* lg 미만에선 동그라미만 — 한 줄이라 탭에 자리를 준다 · sr-only 라 화면 읽기 프로그램에는 이메일이 남는다 */}
        <span className="sr-only text-black/70 lg:not-sr-only dark:text-white/70">{email}</span>
      </span>
      <span aria-hidden className="h-4 w-px bg-black/15 dark:bg-white/20" />
      <button className="whitespace-nowrap rounded-md border border-black/15 px-3 py-1 text-black/70 transition-colors hover:bg-black/5 hover:text-black dark:border-white/20 dark:text-white/70 dark:hover:bg-white/10">
        로그아웃
      </button>
    </form>
  );
}
