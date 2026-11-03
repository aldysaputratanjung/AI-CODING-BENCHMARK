// /api/v1/users — CRUD with server-enforced RBAC.

import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../types";
import type { SessionUser } from "../../shared/schemas";
import { ROLES, USER_STATUSES, createUserSchema, updateUserSchema } from "../../shared/schemas";
import * as usersRepo from "../repositories/users";
import * as usersService from "../services/users";
import { ValidationError, NotFoundError } from "../errors";
import { requirePermission } from "../middleware";

const users = new Hono<{ Bindings: Env; Variables: { user: SessionUser } }>();

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
  role: z.enum(ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
});

function paginationMeta(page: number, pageSize: number, total: number) {
  return { page, page_size: pageSize, total, total_pages: Math.ceil(total / pageSize) };
}

users.use("*", requirePermission("users", "read"));

users.get("/", async (c) => {
  const q = listQuery.safeParse({
    page: c.req.query("page"),
    page_size: c.req.query("page_size"),
    search: c.req.query("search") || undefined,
    role: c.req.query("role") || undefined,
    status: c.req.query("status") || undefined,
  });
  if (!q.success) throw new ValidationError(q.error.flatten());
  const { rows, total } = await usersRepo.list(c.env.DB, q.data, q.data.page, q.data.page_size);
  return c.json({ users: rows.map(usersRepo.mapUserRow), pagination: paginationMeta(q.data.page, q.data.page_size, total) });
});

users.get("/:id", async (c) => {
  const user = await usersRepo.findById(c.env.DB, c.req.param("id") ?? "");
  if (!user) throw new NotFoundError("User not found");
  return c.json({ user: usersRepo.mapUserRow(user) });
});

users.post("/", requirePermission("users", "create"), async (c) => {
  const input = createUserSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) throw new ValidationError(input.error.flatten());
  const actor = c.get("user");
  const user = await usersService.createUser(c, c.env, actor, input.data);
  return c.json({ user: usersRepo.mapUserRow(user!) }, 201);
});

users.put("/:id", requirePermission("users", "update"), async (c) => {
  const input = updateUserSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) throw new ValidationError(input.error.flatten());
  const actor = c.get("user");
  const user = await usersService.updateUser(c, c.env, actor, c.req.param("id") ?? "", input.data);
  return c.json({ user: usersRepo.mapUserRow(user!) });
});

users.delete("/:id", requirePermission("users", "delete"), async (c) => {
  const actor = c.get("user");
  await usersService.deleteUser(c, c.env, actor, c.req.param("id") ?? "");
  return c.json({ ok: true });
});

export default users;
