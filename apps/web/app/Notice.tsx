// 오류 · 404 공통 틀 (10/27) — 가운데 한 덩어리: 작은 꼬리표 · 제목 · 설명 · (사건 번호) · 버튼
// 훅이 없어서 서버(not-found) · 브라우저(error) 양쪽에서 그대로 쓴다
import Link from "next/link";
import type { ReactNode } from "react";

export const PRIMARY =
  "inline-flex h-10 items-center rounded-md bg-black px-4 text-sm font-medium text-white transition-colors hover:bg-black/80 motion-reduce:transition-none dark:bg-white dark:text-black dark:hover:bg-white/80";
export const SECONDARY = "inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium transition-colors hover:bg-muted motion-reduce:transition-none";

export function Notice({
  tag,
  title,
  children,
  digest,
  actions,
}: {
  tag: string;                                         // "404" · "오류"
  title: string;
  children: ReactNode;                                 // 설명 — 무엇이 일어났고 무엇을 하면 되는지
  digest?: string;                                     // 운영에선 진짜 메시지 대신 사건 번호 — 로그에 같은 번호로 남는다
  actions: ReactNode;
}) {
  return (
    <section className="flex min-h-[50vh] items-center justify-center">
      <div className="w-full max-w-md text-center">
        <p className="font-mono text-sm font-medium text-muted-foreground">{tag}</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{children}</p>
        {digest && (
          <p className="mt-4 text-xs text-muted-foreground">
            사건 번호 <span className="select-all font-mono">{digest}</span>
          </p>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-2">{actions}</div>
      </div>
    </section>
  );
}

// 「현황판으로」 — 어디서 막혀도 돌아갈 곳 하나
export function HomeLink({ primary = false }: { primary?: boolean }) {
  return (
    <Link href="/" className={primary ? PRIMARY : SECONDARY}>
      현황판으로
    </Link>
  );
}
