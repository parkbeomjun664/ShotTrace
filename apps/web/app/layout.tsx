import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
  { href: "/records", label: "실적 입력" },
  { href: "/master", label: "마스터" },
] as const;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* 이 헤더는 페이지를 옮겨도 다시 그려지지 않는다 (M07) */}
        <header className="border-b border-black/10 dark:border-white/15">
          <nav className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-3">
            <Link href="/" className="mr-4 font-semibold tracking-tight">
              ShotTrace
            </Link>
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded px-3 py-1.5 text-sm text-black/70 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/10"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/login"
              className="ml-auto rounded px-3 py-1.5 text-sm text-black/50 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/10"
            >
              로그인
            </Link>
          </nav>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
          {children}
        </main>
      </body>
    </html>
  );
}
