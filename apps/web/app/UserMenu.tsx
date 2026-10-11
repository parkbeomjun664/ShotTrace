// 헤더 오른쪽 — 서버가 쿠키를 읽어 "누구냐" 를 그린다 (M19)
import Link from "next/link";

import { createSessionClient } from "@/lib/supabase/session";
import { logout } from "./login/actions";

export async function UserMenu() {                     // async — 서버 컴포넌트라 기다릴 수 있다
  const supabase = await createSessionClient();        // 이 요청의 손목밴드로 만든 클라이언트
  const {
    data: { user },
  } = await supabase.auth.getUser();                   // 🔴 getSession 아님 — 본사에 진짜인지 묻는다

  if (!user) {                                         // 손목밴드가 없거나 가짜
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
      <span className="text-black/60 dark:text-white/60">{user.email}</span>
      <button className="rounded px-3 py-1.5 text-black/50 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/10">
        로그아웃
      </button>
    </form>
  );
}
