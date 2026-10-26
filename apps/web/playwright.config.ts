// E2E — 브라우저로 사용자 흐름을 시험한다 (M26). 실행: npm run e2e
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",                            // .test.ts 는 Vitest 몫 — 이름으로 나눠 서로 안 건드린다
  expect: { timeout: 15_000 },                         // 🔴 5초 → 15초 (10/26) — CI 는 개발 서버가 페이지를 처음 열 때 컴파일한다. 테스트 10개가 동시에 컴파일하면 5초를 넘겼다
  use: {
    baseURL: "http://localhost:3000",
    channel: "chrome",                                 // PC 에 깔린 Chrome — 브라우저를 따로 내려받지 않는다
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: true,                         // 개발 서버가 떠 있으면 그걸 쓴다
  },
});
