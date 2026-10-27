// robots.txt — 사내 시스템이라 검색엔진에는 로그인 화면만
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/login", disallow: "/" },   // 점수가 아니라 의도 — MES 는 검색에 나올 이유가 없다
  };
}
