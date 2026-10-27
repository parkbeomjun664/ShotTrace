// E2E — 브라우저로 사용자 흐름을 시험한다. 실행: npm run e2e
import { defineConfig } from "@playwright/test";

try {
  process.loadEnvFile(".env.local");                   // VIEWER_PASSWORD 등 — 로컬에만 있는 파일 · CI 는 Secret 이 이미 env 에 있다
} catch {}

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",                            // .test.ts 는 Vitest 몫 — 이름으로 나눠 서로 안 건드린다
  expect: { timeout: 15_000 },                         // 🔴 5초 → 15초 (10/26) — CI 는 개발 서버가 페이지를 처음 열 때 컴파일한다. 테스트 10개가 동시에 컴파일하면 5초를 넘겼다
  use: {
    baseURL: "http://localhost:3000",
    channel: "chrome",                                 // PC 에 깔린 Chrome — 브라우저를 따로 내려받지 않는다
    reducedMotion: "reduce",                           // 들어올 때 움직임 끔 (10/27) — 화면 기록이 반쯤 떠오른 순간을 찍지 않게 · 클릭도 바로
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: true,                         // 개발 서버가 떠 있으면 그걸 쓴다
  },
});
