import { createServer } from "node:http";

import { afterEach, describe, expect, it, vi } from "vitest";

import { notifyThreats, type Threat } from "./alert";

const HITS: Threat[] = [{ alert_kind: "비밀번호 스프레이", alert_target: "9.9.9.9", alert_n: 6 }];

afterEach(() => {
  delete process.env.SECURITY_ALERT_WEBHOOK;
  vi.restoreAllMocks();
});

describe("notifyThreats", () => {
  it("URL 이 없으면 아무것도 보내지 않는다 (off 스위치)", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    await notifyThreats(HITS);
    expect(spy).not.toHaveBeenCalled();
  });

  it("빈 목록이면 보내지 않는다", async () => {
    process.env.SECURITY_ALERT_WEBHOOK = "http://127.0.0.1:1/hook";
    const spy = vi.spyOn(globalThis, "fetch");
    await notifyThreats([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("로컬 웹훅으로 실제 POST — {text} 에 종류·대상·건수만", async () => {
    const got = await new Promise<{ method?: string; ct?: string; body: string }>((resolve) => {
      const srv = createServer((req, res) => {
        let b = "";
        req.on("data", (c) => (b += c));
        req.on("end", () => {
          res.statusCode = 200;
          res.end("ok");
          srv.close();
          resolve({ method: req.method, ct: String(req.headers["content-type"]), body: b });
        });
      });
      srv.listen(0, "127.0.0.1", async () => {
        const port = (srv.address() as { port: number }).port;
        process.env.SECURITY_ALERT_WEBHOOK = `http://127.0.0.1:${port}/hook`;
        await notifyThreats(HITS);
      });
    });

    expect(got.method).toBe("POST");
    expect(got.ct).toContain("application/json");
    const body = JSON.parse(got.body);
    expect(body.text).toContain("비밀번호 스프레이");
    expect(body.text).toContain("9.9.9.9");
    expect(body.text).toContain("6");
    expect(body.text).not.toMatch(/password|비밀번호를|token/i);   // 민감정보 없음
  });

  it("전송이 실패해도 throw 하지 않는다 (best-effort)", async () => {
    process.env.SECURITY_ALERT_WEBHOOK = "http://127.0.0.1:9/hook";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    await expect(notifyThreats(HITS)).resolves.toBeUndefined();
  });
});
