// 마스터 (10/26) — 탭 · viewer 는 읽기 전용(버튼 없음). DB 에 아무것도 안 쓴다
import { expect, test } from "@playwright/test";

test("탭이 주소에 남고 · viewer 에게는 바꾸는 버튼이 없다", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("이메일").fill("viewer@example.com");
  await page.getByPlaceholder("비밀번호").fill("parkbeomjun122!!");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/master");

  await expect(page.getByText("admin 계정만 바꿀 수 있어요")).toBeVisible();
  await page.getByRole("link", { name: "비가동 사유" }).click();
  await expect(page).toHaveURL(/tab=downtime/);
  await expect(page.getByText("비계획").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /사용 중지|다시 사용/ })).toHaveCount(0);
});
