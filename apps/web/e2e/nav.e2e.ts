// 상단 내비게이션 (10/26) — 한 줄 · 고정 · 탭 묶음 · 사용자. 화면 기록은 e2e/__screenshots__/
import { expect, test } from "@playwright/test";

import { VIEWER } from "./viewer";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("이메일").fill(VIEWER.email);
  await page.getByPlaceholder("비밀번호").fill(VIEWER.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL("/");
});

test("지금 탭에 표시 · 사용자 이메일", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByRole("link", { name: "현황판" })).toHaveAttribute("aria-current", "page");
  await expect(page.locator("header").getByText("viewer@example.com")).toBeVisible();
});

test("스크롤해도 머리 띠가 위에 붙어 있다", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 500 });
  await page.mouse.wheel(0, 2000);
  await expect.poll(() => page.locator("header").evaluate((e) => e.getBoundingClientRect().top)).toBe(0);
});

for (const width of [1280, 390]) {                     // 데스크톱 · 휴대폰 — 눈으로 볼 기록
  test(`화면 기록 ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `e2e/__screenshots__/nav-${width}.png` });
  });
}
