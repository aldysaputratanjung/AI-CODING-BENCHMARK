// Authentication service: register, login, logout, session resolution.
// Business logic kept independent from HTTP layer.

import type { Context } from "hono";
import type { Env } from "../types";
import type { LoginInput, RegisterInput, SessionUser } from "../../shared/schemas";
import * as usersRepo from "../repositories/users";
import * as sessionsRepo from "../repositories/sessions";
import * as activitiesRepo from "../repositories/activities";
import { hashPassword, verifyPassword } from "../utils/password";
import {
  uuid, newSessionToken, setSessionCookie, clearSessionCookie, getSessionCookie,
  sha256Hex, clientIp,
} from "../utils/auth";
import { GenericAuthError } from "../errors";

const MAX_FAILED_ATTEMPTS = 5;
export { MAX_FAILED_ATTEMPTS };

export class LoginRateLimitedError extends Error {
  constructor() { super("Too many failed attempts. Try again later."); }
}

export async function register(c: Context, env: Env, input: RegisterInput): Promise<SessionUser> {
  const existing = await usersRepo.findByEmail(env.DB, input.email);
  if (existing) throw new GenericAuthError();
  const passwordHash = await hashPassword(input.password);
  const id = uuid();
  const roleId = await usersRepo.getRoleId(env.DB, "user");
  await usersRepo.create(env.DB, {
    id, email: input.email, passwordHash, full_name: input.full_name, roleId,
  });
  await activitiesRepo.log(env.DB, {
    id: uuid(), actorId: id, actorEmail: input.email, action: "auth.register",
    category: "auth", description: `User registered: ${input.email}`,
    targetType: "user", targetId: id, ip: clientIp(c), userAgent: c.req.header("user-agent") ?? null,
  });
  return { id, email: input.email, full_name: input.full_name, role: "user", status: "active", avatar_key: null };
}

export async function login(c: Context, env: Env, input: LoginInput): Promise<SessionUser> {
  // KV-based login rate limiting (non-critical, eventual consistency acceptable).
  const ip = clientIp(c) ?? "unknown";
  const rlKey = `login-rate:${ip}`;
  const attempts = (await env.CACHE.get(rlKey)) ?? "0";
  if (parseInt(attempts, 10) >= 10) throw new LoginRateLimitedError();

  const user = await usersRepo.findByEmail(env.DB, input.email);
  const valid = user ? await verifyPassword(input.password, user.password_hash) : false;
  if (!user || !valid) {
    await env.CACHE.put(rlKey, String(parseInt(attempts, 10) + 1), { expirationTtl: 300 });
    if (user) {
      const next = user.failed_login_attempts + 1;
      await usersRepo.recordFailedLogin(env.DB, user.id, next);
    }
    throw new GenericAuthError();
  }
  if (user.status !== "active") throw new GenericAuthError();

  await usersRepo.resetFailedLogins(env.DB, user.id);
  await env.CACHE.delete(rlKey);

  // Fresh session token (session fixation prevention).
  const token = newSessionToken();
  const tokenHash = await sha256Hex(token);
  await sessionsRepo.create(env.DB, {
    id: uuid(), userId: user.id, tokenHash, ip, userAgent: c.req.header("user-agent") ?? null,
  });
  setSessionCookie(c, token, new Date(Date.now() + 7 * 24 * 3600 * 1000));

  await activitiesRepo.log(env.DB, {
    id: uuid(), actorId: user.id, actorEmail: user.email, action: "auth.login",
    category: "auth", description: `User logged in: ${user.email}`,
    targetType: "user", targetId: user.id, ip, userAgent: c.req.header("user-agent") ?? null,
  });
  return { id: user.id, email: user.email, full_name: user.full_name, role: user.role as SessionUser["role"], status: user.status as SessionUser["status"], avatar_key: user.avatar_key };
}

export async function logout(c: Context, env: Env): Promise<void> {
  const token = getSessionCookie(c);
  if (!token) return;
  const tokenHash = await sha256Hex(token);
  const session = await sessionsRepo.findValidByTokenHash(env.DB, tokenHash);
  if (session) {
    await sessionsRepo.revoke(env.DB, session.id);
    await activitiesRepo.log(env.DB, {
      id: uuid(), actorId: session.user_id, actorEmail: null, action: "auth.logout",
      category: "auth", description: "User logged out",
      targetType: "user", targetId: session.user_id, ip: clientIp(c), userAgent: c.req.header("user-agent") ?? null,
    });
  }
  clearSessionCookie(c);
}

/** Resolve current session user from cookie. Returns null when unauthenticated/expired/revoked. */
export async function currentUser(c: Context, env: Env): Promise<SessionUser | null> {
  const token = getSessionCookie(c);
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const session = await sessionsRepo.findValidByTokenHash(env.DB, tokenHash);
  if (!session) return null;
  const user = await usersRepo.findById(env.DB, session.user_id);
  if (!user || user.status !== "active" || user.deleted_at) return null;
  return {
    id: user.id, email: user.email, full_name: user.full_name,
    role: user.role as SessionUser["role"], status: user.status as SessionUser["status"],
    avatar_key: user.avatar_key,
  };
}

/** Bootstrap initial super admin from secrets (idempotent, never hardcoded). */
export async function bootstrapAdmin(env: Env): Promise<void> {
  const email = env.BOOTSTRAP_ADMIN_EMAIL;
  const password = env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password) return;
  const count = await usersRepo.countActiveSuperAdmins(env.DB);
  if (count > 0) return;
  const existing = await usersRepo.findByEmail(env.DB, email);
  if (existing) return;
  const passwordHash = await hashPassword(password);
  const id = uuid();
  const roleId = await usersRepo.getRoleId(env.DB, "super_admin");
  await usersRepo.create(env.DB, { id, email, passwordHash, full_name: "Super Admin", roleId });
}
