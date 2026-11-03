// /api/v1/dashboard — analytics endpoints (requires manager+).

import { Hono } from "hono";
import type { Env } from "../types";
import { z } from "zod";
import * as analytics from "../services/analytics";
import * as activitiesRepo from "../repositories/activities";
import { ValidationError } from "../errors";
import { requirePermission } from "../middleware";

const dashboard = new Hono<{ Bindings: Env }>();

const dateRangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).refine((v) => v.from <= v.to, { message: "from must be <= to" });

function parseRange(c: { req: { query: (k: string) => any } }) {
  const parsed = dateRangeSchema.safeParse({ from: c.req.query("from"), to: c.req.query("to") });
  if (!parsed.success) throw new ValidationError(parsed.error.flatten());
  return parsed.data;
}

dashboard.use("*", requirePermission("dashboard", "read"));

dashboard.get("/summary", async (c) => {
  const range = parseRange(c);
  return c.json(await analytics.summary(c.env, range));
});

dashboard.get("/revenue", async (c) => {
  const range = parseRange(c);
  return c.json(await analytics.revenueCharts(c.env, range));
});

dashboard.get("/users", async (c) => {
  const range = parseRange(c);
  return c.json(await analytics.userStats(c.env, range));
});

dashboard.get("/activities", async (c) => {
  const rows = await activitiesRepo.recent(c.env.DB, 20);
  return c.json({ activities: rows });
});

export default dashboard;
