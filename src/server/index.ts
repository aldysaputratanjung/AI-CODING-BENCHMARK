// Worker entrypoint — Hono app: API under /api/v1, SPA assets served by Workers Assets.

import { Hono } from "hono";
import { logger } from "hono/logger";
import type { Vars } from "./middleware";
import type { Env } from "./types";
import {
  requestId, authMiddleware, csrfMiddleware, securityHeaders, errorHandler,
} from "./middleware";
import * as authService from "./services/auth";

import authRoutes from "./routes/auth";
import dashboardRoutes from "./routes/dashboard";
import userRoutes from "./routes/users";
import transactionRoutes from "./routes/transactions";
import activityRoutes from "./routes/activities";
import profileRoutes from "./routes/profile";
import systemRoutes from "./routes/system";

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

app.use("*", logger());
app.use("*", securityHeaders);
app.use("*", requestId);
app.onError(errorHandler);

const api = new Hono<{ Bindings: Env; Variables: Vars }>();
api.use("*", authMiddleware);
api.use("*", csrfMiddleware);
api.route("/auth", authRoutes);
api.route("/dashboard", dashboardRoutes);
api.route("/users", userRoutes);
api.route("/transactions", transactionRoutes);
api.route("/activities", activityRoutes);
api.route("/profile", profileRoutes);
api.route("/system", systemRoutes);
app.route("/api/v1", api);

// 404 for unknown API paths — JSON, never the SPA fallback.
app.notFound((c) => {
  if (c.req.path.startsWith("/api/")) {
    return c.json({ error: { code: "NOT_FOUND", message: "Endpoint not found" } }, 404);
  }
  // Non-API paths fall through to SPA via assets run_worker_first config
  // (handled by Workers Assets not_found_handling: single-page-application).
  return c.env.ASSETS.fetch(c.req.raw);
});

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Bootstrap initial super admin from secrets (idempotent per-request check, cheap).
    await authService.bootstrapAdmin(env).catch((e: unknown) => console.error("bootstrap failed:", e));
    return app.fetch(request, env, ctx);
  },
};
