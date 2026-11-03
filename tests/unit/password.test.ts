import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../../src/server/utils/password";

describe("password hashing (PBKDF2-SHA256, Web Crypto)", () => {
  it("hashes and verifies a correct password", async () => {
    const stored = await hashPassword("S3cret!Pass");
    expect(stored).toMatch(/^pbkdf2\$100000\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    expect(await verifyPassword("S3cret!Pass", stored)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const stored = await hashPassword("correct horse");
    expect(await verifyPassword("wrong", stored)).toBe(false);
  });

  it("produces a unique salt per hash (no rainbow-table reuse)", async () => {
    const a = await hashPassword("same-input");
    const b = await hashPassword("same-input");
    expect(a).not.toEqual(b);
  });

  it("rejects malformed stored hashes without throwing", async () => {
    expect(await verifyPassword("x", "plaintext")).toBe(false);
    expect(await verifyPassword("x", "pbkdf2$abc$00$00")).toBe(false);
    expect(await verifyPassword("x", "pbkdf2$0$abcd$ef01")).toBe(false);
  });
});
