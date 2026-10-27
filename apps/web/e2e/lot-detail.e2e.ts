// LOT 상세 (10/26) — 작은 차트 4개의 툴팁 동기화 · 이상 샷만 토글 · 화면 기록
import { expect, test } from "@playwright/test";

import { VIEWER } from "./viewer";

const LOT = "S14-20201027-CN7LH";                      // 초기 불량 5개가 몰린 LOT — 이상 샷이 있다

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("이메일").fill(VIEWER.email);
  await page.getByPlaceholder("비밀번호").fill(VIEWER.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL("/");
});

test("한 차트에 마우스를 올리면 — 값 상자는 그 차트에만, 세로 기준선은 네 차트 모두 (syncId)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/lots/${LOT}`);
  // 요소에 직접 올린다 — 차트가 화면 아래에 있어 좌표로 움직이면 화면 밖을 가리킨다 (hover 는 스크롤까지 해 준다)
  await page.locator(".recharts-surface").first().hover({ position: { x: 300, y: 80 } });
  await expect.poll(() => page.locator(".recharts-tooltip-cursor").count()).toBe(4);   // 같은 샷 자리에 기준선 넷
  await expect(page.locator(".recharts-tooltip-wrapper").filter({ hasText: /#\d+/ })).toHaveCount(1);   // 값 상자는 하나
});

test("샷 표는 기본이 이상 샷만 — 토글하면 전부", async ({ page }) => {
  await page.goto(`/lots/${LOT}`);
  const toggle = page.getByRole("link", { name: /이상 샷만/ });
  const [, only, all] = (await toggle.innerText()).match(/\((\d+) \/ (\d+)\)/)!.map(Number);
  expect(only).toBeLessThan(all);
  await expect(page.locator("#shots tbody tr")).toHaveCount(Math.min(only, 20));
  await toggle.click();
  await expect(page).toHaveURL(/shots=all/);
  await expect(page.locator("#shots tbody tr")).toHaveCount(20);   // 전부 — 한 쪽에 20행
});

for (const width of [1280, 390]) {
  test(`화면 기록 ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/lots/${LOT}`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `e2e/__screenshots__/lot-detail-${width}.png`, fullPage: true });
  });
}

test("화면 기록 — S14-20201104-RG3LH (불량이 흩어진 LOT)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/lots/S14-20201104-RG3LH");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "e2e/__screenshots__/lot-detail-RG3LH.png", fullPage: true });
});
