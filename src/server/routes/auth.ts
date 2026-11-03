// /api/v1/auth — registration, login, logout, session info.

import { Hono } from "hono";
import type { Env } from "../types";
import { registerSchema, loginSchema } from "../../shared/schemas";
import * as authService from "../services/auth";
import { ValidationError } from "../errors";

const auth = new Hono<{ Bindings: Env; Variables: { user: unknown } }>();

auth.post("/register", async (c) => {
  const input = registerSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) throw new ValidationError(input.error.flatten());
  const user = await authService.register(c, c.env, input.data);
  return c.json({ user }, 201);
});

auth.post("/login", async (c) => {
  const input = loginSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) throw new ValidationError(input.error.flatten());
  const user = await authService.login(c, c.env, input.data);
  return c.json({ user });
});

auth.post("/logout", async (c) => {
  await authService.logout(c, c.env);
  return c.json({ ok: true });
});

auth.get("/me", async (c) => {
  const user = await authService.currentUser(c, c.env);
  if (!user) return c.json({ user: null }, 401);
  return c.json({ user });
});

export default auth;
