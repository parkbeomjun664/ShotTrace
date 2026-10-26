// LOT 목록 (10/26) — 불량만 · 정렬 · 줄 클릭. 읽기만 한다 (viewer)
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("이메일").fill("viewer@example.com");
  await page.getByPlaceholder("비밀번호").fill("parkbeomjun122!!");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/lots");
});

const rows = (page: import("@playwright/test").Page) => page.locator("tbody tr");

test("「불량 있는 LOT만」 — 남은 줄은 모두 불량이 있다 · 주소에 남는다", async ({ page }) => {
  const before = await rows(page).count();
  await page.getByRole("link", { name: "불량 있는 LOT만" }).click();
  await expect(page).toHaveURL(/defect=1/);
  const after = await rows(page).count();
  expect(after).toBeGreaterThan(0);
  expect(after).toBeLessThan(before);
  for (const fail of await rows(page).locator("td:nth-child(5)").allInnerTexts()) expect(Number(fail)).toBeGreaterThan(0);
});

test("수율을 누르면 낮은 순 — 맨 위가 가장 나쁜 LOT", async ({ page }) => {
  await page.getByRole("link", { name: "수율" }).click();
  await expect(page).toHaveURL(/sort=yield&dir=asc/);
  const rates = (await rows(page).locator("td:nth-child(6)").allInnerTexts()).map((t) => parseFloat(t.replace(/[^\d.]/g, "")));
  expect(rates[0]).toBe(Math.min(...rates.filter((r) => !Number.isNaN(r))));
});

test("줄을 누르면 그 LOT 상세로", async ({ page }) => {
  const first = rows(page).first();
  const id = (await first.locator("td").first().locator("a").innerText()).trim();
  // 제품 칸 자리를 마우스로 — 줄을 덮은 링크가 받는다 (locator.click 은 "가로챈다" 며 기다린다 · 그게 바로 의도한 동작)
  const box = (await first.locator("td:nth-child(2)").boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page).toHaveURL(`/lots/${id}`);
});
