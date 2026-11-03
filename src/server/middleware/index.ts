// Middleware: request-id, auth resolution, RBAC, CSRF, security headers, error handling.

import type { Context, Next } from "hono";
import type { Env } from "../types";
import { ROLE_HIERARCHY, type Role, type SessionUser, PERMISSIONS } from "../../shared/schemas";
import * as authService from "../services/auth";
import { AppError, ForbiddenError } from "../errors";

export type Vars = {
  requestId: string;
  user: SessionUser | null;
};

// ---------- Request ID ----------
export async function requestId(c: Context, next: Next) {
  c.set("requestId", crypto.randomUUID());
  await next();
  c.header("X-Request-Id", c.get("requestId"));
}

// ---------- Authentication ----------
export async function authMiddleware(c: Context, next: Next) {
  const user = await authService.currentUser(c, c.env as Env);
  c.set("user", user);
  await next();
}

/** Requires an authenticated user (401 otherwise). */
export async function requireAuth(c: Context, next: Next) {
  if (!c.get("user")) throw new AppError(401, "UNAUTHORIZED", "Authentication required");
  await next();
}

/** Requires a role at or above `minRole` (403 otherwise). Server-side enforcement. */
export function requireRole(minRole: Role) {
  return async (c: Context, next: Next) => {
    const user = c.get("user") as SessionUser | null;
    if (!user) throw new AppError(401, "UNAUTHORIZED", "Authentication required");
    if (ROLE_HIERARCHY[user.role] < ROLE_HIERARCHY[minRole]) {
      throw new ForbiddenError(`Requires ${minRole} role or higher`);
    }
    await next();
  };
}

export function requirePermission(domain: keyof typeof PERMISSIONS, action: string) {
  return requireRole((PERMISSIONS[domain] as Record<string, Role>)[action]);
}

// ---------- CSRF ----------
/** Double-check origin for cookie-authenticated state-changing requests. */
export async function csrfMiddleware(c: Context, next: Next) {
  const method = c.req.method;
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return next();
  // Origin check: state-changing requests must come from our own origin.
  const origin = c.req.header("origin");
  const host = c.req.header("host");
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) throw new ForbiddenError("Cross-origin request blocked");
    } catch (e) {
      if (e instanceof ForbiddenError) throw e;
      throw new ForbiddenError("Invalid origin");
    }
  }
  await next();
}

// ---------- Security headers ----------
export async function securityHeaders(c: Context, next: Next) {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  c.header("Content-Security-Policy", [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "font-src 'self' data:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "));
}

// ---------- Error handling ----------
export function errorHandler(err: Error, c: Context) {
  if (err instanceof AppError) {
    return c.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      err.status as 400 | 401 | 403 | 404 | 409 | 429,
    );
  }
  console.error(`[${c.get("requestId")}] Unhandled error:`, err?.message, err?.stack);
  return c.json({ error: { code: "INTERNAL", message: "Internal server error" } }, 500);
}
