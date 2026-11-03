import { describe, it, expect } from "vitest";
import { registerTool, listTools } from "../src/registry";

// Uji logika kernel yang bisa diuji tanpa runtime Workers:
// tool registry + trace serialization kontrak.
describe("NEXUS kernel", () => {
  it("tool registry: register & list", async () => {
    let called = false;
    registerTool({
      name: "test-tool",
      description: "uji",
      async run() { called = true; return { ok: 1 }; },
    });
    const names = listTools().map((t) => t.name);
    expect(names).toContain("test-tool");
    const t = listTools().find((x) => x.name === "test-tool")!;
    const res = await t.run({}, {} as any);
    expect(called).toBe(true);
    expect(res).toEqual({ ok: 1 });
  });

  it("ping tool tersedia", () => {
    expect(listTools().map((t) => t.name)).toContain("ping");
  });

  it("trace entry serialization roundtrip", () => {
    const entry = { ts: 123, action: "tool_call", detail: { tool: "ping" } };
    const round = JSON.parse(JSON.stringify(entry));
    expect(round).toEqual(entry);
  });
});
