// E2E — 진짜 브라우저로 "막히는 쪽" 흐름만. DB 에 아무것도 안 쓰고 공개 viewer 만 쓴다 → CI 에도 넣는다
import { expect, test, type Page } from "@playwright/test";

import { VIEWER } from "./viewer";

async function login(page: Page, email: string, password: string) {   // 사용자가 하는 그대로 — 칸을 채우고 버튼을 누른다
  await page.goto("/login");
  await page.getByPlaceholder("이메일").fill(email);    // 🔵 #id 가 아니라 사용자가 보는 글자로 찾는다
  await page.getByPlaceholder("비밀번호").fill(password);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL("/");                   // 로그인 → redirect("/") 까지 기다린다
}

test("로그인하지 않으면 실적 입력에 못 들어간다", async ({ page }) => {
  await page.goto("/records");
  await expect(page).toHaveURL(/\/login/);            // proxy 가 돌려보낸다
});

// 10/26 — viewer 에겐 쓰기 버튼이 처음부터 잠긴다. 예전엔 저장을 눌러 RLS 의 42501 을 봤다
// 🔴 버튼 잠금은 친절일 뿐 — DB 가 막는 증거는 scripts/verify/rls_matrix.py (5역할 × 21칸) 가 맡는다
test("viewer 는 실적 입력이 잠겨 있다 — 저장 버튼 · 입력 칸이 눌리지 않는다", async ({ page }) => {
  await login(page, VIEWER.email, VIEWER.password);
  await page.goto("/records");

  await expect(page.getByText("둘러보기 계정은 읽기 전용이에요")).toBeVisible();
  await expect(page.getByRole("button", { name: "저장" })).toBeDisabled();
  await expect(page.getByLabel("LOT")).toBeDisabled();
  await expect(page.getByRole("link", { name: /실적 입력.*읽기 전용/ })).toBeVisible();   // 탭의 자물쇠
  await expect(page.getByRole("link", { name: /마스터.*읽기 전용/ })).toBeVisible();     // 마스터는 admin 만 — viewer 에게도 자물쇠
});
