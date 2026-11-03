// /api/v1/activities — audit logs (admin+ only, sensitive information).

import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../types";
import * as activitiesRepo from "../repositories/activities";
import { ValidationError, NotFoundError } from "../errors";
import { requirePermission } from "../middleware";

const activities = new Hono<{ Bindings: Env }>();

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
  category: z.enum(["auth", "user", "transaction", "system"]).optional(),
});

activities.use("*", requirePermission("activities", "read"));

activities.get("/", async (c) => {
  const q = listQuery.safeParse({
    page: c.req.query("page"),
    page_size: c.req.query("page_size"),
    category: c.req.query("category") || undefined,
  });
  if (!q.success) throw new ValidationError(q.error.flatten());
  const { rows, total } = await activitiesRepo.list(c.env.DB, { category: q.data.category }, q.data.page, q.data.page_size);
  return c.json({
    activities: rows,
    pagination: {
      page: q.data.page, page_size: q.data.page_size,
      total, total_pages: Math.ceil(total / q.data.page_size),
    },
  });
});

activities.get("/:id", async (c) => {
  const row = await activitiesRepo.findById(c.env.DB, c.req.param("id"));
  if (!row) throw new NotFoundError("Activity not found");
  return c.json({ activity: row });
});

export default activities;
