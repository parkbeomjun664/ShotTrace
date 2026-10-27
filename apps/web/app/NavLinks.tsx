"use client";   // 지금 주소(usePathname)는 브라우저가 안다 — 탭의 "여기" 표시만 여기서 (10/26)

import { Lock } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";

// 탭은 세 묶음 — 보기(현황) | 추적 · 분석 | 쓰기. 묶음 사이에 얇은 세로선 (10/26)
const GROUPS = [
  [{ href: "/", label: "현황판" }],
  [
    { href: "/lots", label: "LOT 추적" },
    { href: "/quality", label: "품질" },
    { href: "/oee", label: "OEE" },
    { href: "/downtime", label: "비가동" },            // 017
  ],
  [
    { href: "/records", label: "실적 입력", write: "worker" },   // 쓰기 화면 — 쓸 수 있는 역할이 아니면 자물쇠
    { href: "/master", label: "마스터", write: "admin" },       // 마스터는 admin 만 고친다 (019) — worker 에게도 자물쇠 (10/26)
  ],
] as const;

export function NavLinks({ role }: { role: string | null }) {
  const canWrite = (need: "worker" | "admin") => (need === "admin" ? role === "admin" : role === "worker" || role === "admin");
  const path = usePathname();
  return GROUPS.map((group, i) => (
    <Fragment key={i}>
      {i > 0 && <span aria-hidden className="mx-2 h-4 w-px shrink-0 self-center bg-border" />}
      {group.map((item) => {
        const here = item.href === "/" ? path === "/" : path.startsWith(item.href);   // /lots/S14-… 도 "LOT 추적"
        const locked = "write" in item && !canWrite(item.write);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={here ? "page" : undefined}   // 화면 읽기 프로그램에도 "여기" 를 알린다
            // 🔴 whitespace-nowrap — 좁아지면 "현황/판" 처럼 쪼개졌다 · 하단 2px 바 = 지금 보는 탭
            className={`relative flex shrink-0 items-center gap-1 whitespace-nowrap border-b-2 px-3 py-5 text-[15px] transition-colors ${
              here
                ? "border-primary font-semibold text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.label}
            {locked && (
              <>
                <Lock aria-hidden className="size-3" />
                <span className="sr-only">(읽기 전용)</span>
              </>
            )}
          </Link>
        );
      })}
    </Fragment>
  ));
}
