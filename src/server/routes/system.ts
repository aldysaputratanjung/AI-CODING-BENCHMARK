// System routes: health & version.

import { Hono } from "hono";
import type { Env } from "../types";

const system = new Hono<{ Bindings: Env }>();

system.get("/health", async (c) => {
  // Verify D1 connectivity.
  try {
    await c.env.DB.prepare("SELECT 1").first();
    return c.json({ status: "ok", db: "ok" });
  } catch {
    return c.json({ status: "degraded", db: "error" }, 503);
  }
});

system.get("/version", (c) => c.json({ version: c.env.APP_VERSION ?? "dev" }));

export default system;
