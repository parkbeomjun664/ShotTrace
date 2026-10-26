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

test("판정 기준 탭 · 이력은 viewer 도 볼 수 있고, 추가 · 수정 버튼은 없다", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("이메일").fill("viewer@example.com");
  await page.getByPlaceholder("비밀번호").fill("parkbeomjun122!!");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/master?tab=spec");

  await expect(page.getByRole("cell", { name: "금형3 온도", exact: true })).toBeVisible();      // 028 로 옮겨 담은 네 줄
  await expect(page.getByRole("button", { name: /^(추가|수정)$/ })).toHaveCount(0);
  await page.getByRole("button", { name: "금형3 온도 변경 이력" }).click();
  await expect(page.getByRole("heading", { name: "금형3 온도 · 변경 이력" })).toBeVisible();
});
