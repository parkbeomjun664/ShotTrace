import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { UserMenu } from "./UserMenu";                 // 헤더 오른쪽 — 누가 로그인했나 (M19)
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

// 네비게이션. 화면이 늘어나면 여기만 고친다.
const NAV = [
  { href: "/", label: "현황판" },
  { href: "/lots", label: "LOT 추적" },
  { href: "/quality", label: "품질" },
  { href: "/oee", label: "OEE" },                         // M24
  { href: "/records", label: "실적 입력" },
  { href: "/downtime", label: "비가동" },                 // M23 · 017
  { href: "/master", label: "마스터" },
] as const;

export default async function RootLayout({ children }: LayoutProps<"/">) {   // async — 쿠키를 읽어 "누구냐" 를 한 번 묻는다
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();   // 🔴 한 번만 — getUser 는 매번 Supabase 에 물으러 간다

  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* 이 헤더는 페이지를 옮겨도 다시 그려지지 않는다 (M07) */}
        {/* 비로그인에겐 헤더를 안 그린다 — 로그인 화면이 제목을 갖는다 (10/26) */}
        {user && (
          <header className="border-b border-black/10 dark:border-white/15">
            <nav className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-3">
              <Link href="/" className="mr-4 font-semibold tracking-tight">
                ShotTrace
              </Link>
              {user && NAV.map((item) => (                 // 🔴 비로그인에겐 메뉴를 안 그린다 — 못 들어갈 문에 안내판을 걸지 않는다 (10/20)
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded px-3 py-1.5 text-sm text-black/70 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/10"
                >
                  {item.label}
                </Link>
              ))}
              {/* 레이아웃이 읽은 "누구냐" 를 받아 그린다 — 로그인 전엔 링크, 후엔 이메일 + 로그아웃 */}
              <UserMenu email={user?.email} />
            </nav>
          </header>
        )}

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
          {children}
        </main>
      </body>
    </html>
  );
}
