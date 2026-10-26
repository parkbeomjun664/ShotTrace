// 비가동 (10/26) — viewer 잠금 · 시연 토글 · 빗금 → 목록 줄. DB 에 아무것도 안 쓴다 (viewer)
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("이메일").fill("viewer@example.com");
  await page.getByPlaceholder("비밀번호").fill("parkbeomjun122!!");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL("/");
});

test("viewer 는 기록 · 직접 추가가 잠겨 있고, 이유를 툴팁으로 말한다", async ({ page }) => {
  await page.goto("/downtime");
  const record = page.getByRole("button", { name: "선택 항목 기록" }).first();
  await expect(record).toBeDisabled();
  await expect(record).toHaveAttribute("title", "둘러보기 계정은 조회만 가능해요");
  await expect(page.getByRole("button", { name: "직접 추가" })).toBeDisabled();
});

test("시연 데이터는 기본 제외 — 토글하면 날짜 탭에 2026 이 생긴다", async ({ page }) => {
  await page.goto("/downtime");
  await expect(page.locator('a[href*="day=2026-"]')).toHaveCount(0);
  await page.getByRole("link", { name: /시연 포함/ }).click();
  await expect(page).toHaveURL(/demo=1/);
  await expect(page.locator('a[href*="day=2026-"]').first()).toBeVisible();
});

test("빗금을 누르면 목록의 그 줄로 내려간다", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 700 });
  await page.goto("/downtime");
  const hatch = page.getByRole("link", { name: /사유 미입력 정지 .* 목록으로/ }).first();
  const target = (await hatch.getAttribute("href"))!;       // #stop-…
  await hatch.click();
  await expect(page).toHaveURL(new RegExp(`${target}$`));
  await expect(page.locator(target)).toBeInViewport();
});
