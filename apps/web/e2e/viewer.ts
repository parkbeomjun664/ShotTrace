// 둘러보기(viewer) 계정 — 비밀번호는 코드에 두지 않는다 (공개용 정리)
// 로컬은 apps/web/.env.local, CI 는 GitHub Secret 의 VIEWER_PASSWORD (playwright.config 가 .env.local 을 읽는다)
const password = process.env.VIEWER_PASSWORD;
if (!password) throw new Error("VIEWER_PASSWORD 가 없다 — apps/web/.env.local 이나 CI Secret 에 넣는다");

export const VIEWER = { email: "viewer@example.com", password };
