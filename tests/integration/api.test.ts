// Integration smoke tests: exercise the real Worker (workerd + local D1)
// end-to-end via the vitest-pool-workers SELF fetcher.

import { describe, expect, test } from "vitest";
import { SELF } from "cloudflare:test";

const BASE = "http://self";

function toJson(r: Response) {
  return r.json().then((b) => ({ status: r.status, body: b as Record<string, unknown> }));
}

async function login(email: string, password: string) {
  const res = await SELF.fetch(`${BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const setCookie = res.headers.get("Set-Cookie") ?? "";
  const sessionCookie = setCookie.match(/(?:^|;\s*)session=([^;]+)/)?.[1] ?? "";
  return { res, sessionCookie };
}

describe("integration smoke", () => {
  test("health: 200 with db ok", async () => {
    const { status, body } = await toJson(await SELF.fetch(`${BASE}/api/v1/system/health`));
    expect(status).toBe(200);
    expect(body).toEqual({ status: "ok", db: "ok" });
  });

  test("unknown API path returns JSON 404, not SPA fallback", async () => {
    const { status, body } = await toJson(await SELF.fetch(`${BASE}/api/v1/nope/nothing`));
    expect(status).toBe(404);
    expect((body.error as Record<string, string>)?.code).toBe("NOT_FOUND");
  });

  test("protected endpoint rejects unauthenticated request (401)", async () => {
    const { status } = await toJson(await SELF.fetch(`${BASE}/api/v1/dashboard/summary`));
    expect(status).toBe(401);
  });

  test("register -> login -> authenticated dashboard flow", async () => {
    const email = `user+${Date.now()}@test.local`;
    const password = "Sup3rSecret!pass";

    // Register
    const reg = await toJson(
      await SELF.fetch(`${BASE}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name: "Integration Tester" }),
      })
    );
    expect(reg.status).toBeLessThan(400);

    // Login sets a session cookie
    const { res: loginRes, sessionCookie } = await login(email, password);
    expect(loginRes.status).toBeLessThan(400);
    expect(sessionCookie.length).toBeGreaterThan(10);

    // Authenticated request succeeds
    const dash = await toJson(
      await SELF.fetch(`${BASE}/api/v1/dashboard/summary`, {
        headers: { Cookie: `session=${sessionCookie}` },
      })
    );
    expect(dash.status).toBe(200);
  });

  test("login with wrong password is rejected (401)", async () => {
    const { res } = await login("admin@test.local", "wrong-password-123");
    expect(res.status).toBe(401);
  });

  test("validation: register with weak password rejected (400)", async () => {
    const { status } = await toJson(
      await SELF.fetch(`${BASE}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "x@y.test", password: "short", name: "X" }),
      })
    );
    expect(status).toBe(400);
  });

  test("security headers present on API responses", async () => {
    const res = await SELF.fetch(`${BASE}/api/v1/system/health`);
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});
