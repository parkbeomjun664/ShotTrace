// E2E — 진짜 브라우저로 "막히는 쪽" 흐름만. DB 에 아무것도 안 쓰고 공개 viewer 만 쓴다 → CI 에도 넣는다 (M26)
import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, email: string, password: string) {   // 사용자가 하는 그대로 — 칸을 채우고 버튼을 누른다
  await page.goto("/login");
  await page.getByPlaceholder("이메일").fill(email);    // 🔵 #id 가 아니라 사용자가 보는 글자로 찾는다
  await page.getByPlaceholder("비밀번호").fill(password);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL("/");                   // 로그인 → redirect("/") 까지 기다린다
}

test("로그인하지 않으면 실적 입력에 못 들어간다", async ({ page }) => {
  await page.goto("/records");
  await expect(page).toHaveURL(/\/login/);            // proxy 가 돌려보낸다 (M19)
});

test("viewer 는 실적을 저장할 수 없다 — 그리고 쓴 값은 남는다", async ({ page }) => {
  await login(page, "viewer@example.com", "parkbeomjun122!!");
  await page.goto("/records");

  const form = page.locator("form", { has: page.getByRole("button", { name: "저장" }) });   // 폼이 둘(저장 · 정정) — 저장 버튼이 있는 쪽으로 좁힌다
  await form.locator('select[name="lotId"]').selectOption({ index: 1 });
  await form.getByPlaceholder("양품").fill("1");
  await form.getByRole("button", { name: "저장" }).click();

  await expect(page.getByText("실적 입력 권한이 없어요")).toBeVisible();   // 42501 → 사람 말 · 보일 때까지 잠깐 기다린다
  await expect(form.getByPlaceholder("양품")).toHaveValue("1");   // 실패해도 쓴 값은 남는다 (10/16)
});
