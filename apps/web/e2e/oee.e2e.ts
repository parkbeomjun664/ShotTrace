// OEE 표 (10/26) — 시연 LOT 은 기본 숨김 · 포함하면 맨 아래
import { expect, test } from "@playwright/test";

import { VIEWER } from "./viewer";

test("시연 LOT 은 기본 숨김 · 토글하면 맨 아래에 붙는다", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("이메일").fill(VIEWER.email);
  await page.getByPlaceholder("비밀번호").fill(VIEWER.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/oee");

  const rows = page.locator("tbody tr");
  await expect(rows.filter({ hasText: "시연" })).toHaveCount(0);

  await page.getByRole("link", { name: /시연 LOT 포함/ }).click();
  await expect(page).toHaveURL(/demo=1/);
  const n = await rows.filter({ hasText: "시연" }).count();
  expect(n).toBeGreaterThan(0);
  const texts = await rows.allInnerTexts();
  expect(texts.slice(-n).every((t) => t.includes("시연"))).toBe(true);   // 시연 줄은 전부 맨 아래
});
