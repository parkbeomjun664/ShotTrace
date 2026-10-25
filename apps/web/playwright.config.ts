// E2E — 브라우저로 사용자 흐름을 시험한다 (M26). 실행: npm run e2e
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",                            // .test.ts 는 Vitest 몫 — 이름으로 나눠 서로 안 건드린다
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
