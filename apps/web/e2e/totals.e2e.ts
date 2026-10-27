// 두 화면의 합계가 맞물리나 (10/26) — 현황판 생산 = 품질 전체 + LOT 에 안 묶인 부품
// 현황판은 부품을 직접 세고, 품질은 LOT 저장 수량을 더한다. 차이는 숨기지 않고 화면에 드러난 그 숫자여야 한다
import { expect, test } from "@playwright/test";

import { VIEWER } from "./viewer";

const num = (s: string) => Number(s.replace(/,/g, ""));

test("현황판 생산 = 품질 전체 + LOT 밖 부품", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("이메일").fill(VIEWER.email);
  await page.getByPlaceholder("비밀번호").fill(VIEWER.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL("/");

  const plant = num((await page.getByText(/생산 [\d,]+/).first().innerText()).match(/생산 ([\d,]+)/)![1]);
  const orphanText = await page.getByText(/LOT에 안 묶인 부품/).innerText().catch(() => "");   // 0 이면 줄이 없다
  const orphan = orphanText ? num(orphanText.match(/부품 ([\d,]+)개/)![1]) : 0;

  await page.goto("/quality");
  const quality = num((await page.getByText(/전체 [\d,]+개/).innerText()).match(/전체 ([\d,]+)개/)![1]);

  expect(plant).toBe(quality + orphan);
});
