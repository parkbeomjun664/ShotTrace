// 「둘러보기로 시작」 (공개용 정리) — 계정을 몰라도 읽기 전용으로 들어간다. DB 에 아무것도 안 쓴다
import { expect, test } from "@playwright/test";

test("둘러보기로 시작 — 비밀번호 없이 viewer 로 들어가고, 쓰기 화면은 잠겨 있다", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "둘러보기로 시작" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByText("viewer@example.com")).toBeVisible();   // 머리 띠의 사용자
  await page.goto("/records");
  await expect(page.getByText("둘러보기 계정은 읽기 전용이에요")).toBeVisible();
});
