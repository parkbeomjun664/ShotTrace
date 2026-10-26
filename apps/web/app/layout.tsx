import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NavLinks } from "./NavLinks";                 // 메뉴 — 지금 보는 페이지에 밑줄 (브라우저에서 · 10/26)
import { UserMenu } from "./UserMenu";                 // 헤더 오른쪽 — 누가 로그인했나 (M19)
import { getMyRole } from "@/lib/queries";
import { createSessionClient } from "@/lib/supabase/session";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ShotTrace",
  description: "사출성형 MES — LOT과 설비 상태를 시간 구간으로 잇는다",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {   // async — 쿠키를 읽어 "누구냐" 를 한 번 묻는다
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();   // 🔴 한 번만 — getUser 는 매번 Supabase 에 물으러 간다
  const role = user ? await getMyRole() : null;       // 역할 — 탭 자물쇠 (10/26) · 막는 건 RLS

  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* 이 헤더는 페이지를 옮겨도 다시 그려지지 않는다 (M07) */}
        {/* 비로그인에겐 헤더를 안 그린다 — 로그인 화면이 제목을 갖는다 (10/26) */}
        {user && (
          // 한 줄 머리 띠 (10/26) — [로고] [탭] ……… [사용자]. 스크롤해도 위에 붙어 있다
          <header className="sticky top-0 z-40 border-b bg-white dark:bg-background">
            {/* 본문과 같은 max-w-7xl · px-6 — 로고와 본문 제목이 한 선에서 시작한다 */}
            <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 px-6 sm:flex-nowrap">
              <Link href="/" className="shrink-0 py-5 text-lg font-semibold tracking-tight sm:py-0">
                ShotTrace
              </Link>
              {/* 1024px 미만 — 탭 줄만 옆으로 민다 · 스크롤바는 숨긴다 (글자는 쪼개지 않는다) */}
              {/* 🔴 640px 미만은 탭을 아랫줄로 (order-last · w-full) — 한 줄이면 로고 · 배지 · 로그아웃이 자리를 다 먹어 탭 폭이 0 이었다 */}
              <nav className="order-last flex w-full min-w-0 overflow-x-auto [scrollbar-width:none] sm:order-none sm:w-auto sm:flex-1 [&::-webkit-scrollbar]:hidden">
                <NavLinks role={role} />
              </nav>
              {/* 레이아웃이 읽은 "누구냐" 를 받아 그린다 — 동그라미 + 이메일 */}
              <div className="ml-auto sm:ml-0">
                <UserMenu email={user?.email} />
              </div>
            </div>
          </header>
        )}

        <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-10">
          {children}
        </main>
      </body>
    </html>
  );
}
