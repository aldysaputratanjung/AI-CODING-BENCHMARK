// /api/v1/profile — own profile + avatar upload to R2 (validated).

import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../types";
import type { SessionUser } from "../../shared/schemas";
import * as profilesRepo from "../repositories/profiles";
import { ValidationError, NotFoundError } from "../errors";
import { requireAuth } from "../middleware";
import { clientIp, uuid } from "../utils/auth";
import * as activitiesRepo from "../repositories/activities";

const profile = new Hono<{ Bindings: Env; Variables: { user: SessionUser } }>();

profile.use("*", requireAuth);

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const updateProfileSchema = z.object({
  display_name: z.string().min(2).max(100).optional(),
  bio: z.string().max(500).optional(),
  timezone: z.string().max(50).optional(),
});

profile.get("/", async (c) => {
  const user = c.get("user");
  const p = await profilesRepo.getProfile(c.env.DB, user.id);
  if (!p) throw new NotFoundError("Profile not found");
  return c.json({ profile: p, user });
});

profile.put("/", async (c) => {
  const input = updateProfileSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) throw new ValidationError(input.error.flatten());
  await profilesRepo.updateProfile(c.env.DB, c.get("user").id, input.data);
  const p = await profilesRepo.getProfile(c.env.DB, c.get("user").id);
  return c.json({ profile: p });
});

// Avatar upload — validated type & size, stored in R2, served via /api/v1/profile/avatar
profile.post("/avatar", async (c) => {
  const form = await c.req.formData().catch(() => null);
  if (!form) throw new ValidationError({ form: ["multipart/form-data required"] });
  const file = form.get("file");
  if (!(file instanceof File)) throw new ValidationError({ file: ["file field required"] });
  if (file.size > MAX_AVATAR_BYTES) throw new ValidationError({ file: ["Max size 2MB"] });
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new ValidationError({ file: ["Only JPEG, PNG, WebP, GIF allowed"] });
  }
  const user = c.get("user");
  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const key = `avatars/${user.id}/${uuid()}.${ext}`;
  await c.env.STORAGE.put(key, file.stream(), {
    httpMetadata: { contentType: file.type, cacheControl: "public, max-age=86400" },
  });
  await profilesRepo.updateProfile(c.env.DB, user.id, { avatar_key: key });
  await activitiesRepo.log(c.env.DB, {
    id: uuid(), actorId: user.id, actorEmail: user.email, action: "profile.avatar_upload",
    category: "user", description: "Uploaded profile avatar",
    targetType: "user", targetId: user.id, ip: clientIp(c), userAgent: c.req.header("user-agent") ?? null,
  });
  return c.json({ avatar_key: key }, 201);
});

// Avatar retrieval — auth required, reads from R2 (no public bucket access).
profile.get("/avatar", async (c) => {
  const user = c.get("user");
  const p = await profilesRepo.getProfile(c.env.DB, user.id);
  if (!p?.avatar_key) throw new NotFoundError("No avatar");
  const obj = await c.env.STORAGE.get(p.avatar_key);
  if (!obj) throw new NotFoundError("No avatar");
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("Cache-Control", "private, max-age=3600");
  headers.set("Content-Disposition", "inline");
  return new Response(obj.body, { headers });
});

export default profile;
