// User management service — enforces super-admin protections server-side.

import type { Context } from "hono";
import type { Env } from "../types";
import type { CreateUserInput, Role, UpdateUserInput, UserStatus } from "../../shared/schemas";
import { ROLE_HIERARCHY } from "../../shared/schemas";
import * as usersRepo from "../repositories/users";
import * as activitiesRepo from "../repositories/activities";
import { hashPassword } from "../utils/password";
import { uuid, clientIp } from "../utils/auth";
import { ConflictError, ForbiddenError, NotFoundError } from "../errors";

export async function createUser(c: Context, env: Env, actor: { id: string; email: string; role: Role }, input: CreateUserInput) {
  // Only super_admin may create super_admin accounts (privilege escalation guard).
  if (input.role === "super_admin" && actor.role !== "super_admin") {
    throw new ForbiddenError("Only a super admin can create super admins");
  }
  const existing = await usersRepo.findByEmail(env.DB, input.email);
  if (existing) throw new ConflictError("Email already registered");
  const passwordHash = await hashPassword(input.password);
  const id = uuid();
  const roleId = await usersRepo.getRoleId(env.DB, input.role);
  await usersRepo.create(env.DB, { id, email: input.email, passwordHash, full_name: input.full_name, roleId });
  await logActivity(env, c, actor, "user.create", `Created user ${input.email}`, "user", id);
  return usersRepo.findById(env.DB, id);
}

export async function updateUser(
  c: Context, env: Env, actor: { id: string; email: string; role: Role },
  targetId: string, input: UpdateUserInput,
) {
  const target = await usersRepo.findById(env.DB, targetId);
  if (!target) throw new NotFoundError("User not found");

  // Authorization: cannot modify an account with a strictly higher role than yours,
  // and only super_admin may grant/revoke super_admin.
  if (ROLE_HIERARCHY[actor.role] < ROLE_HIERARCHY[target.role as Role]) {
    throw new ForbiddenError("Cannot modify a higher-privileged account");
  }
  const newRole = (input.role ?? target.role) as Role;
  if ((newRole === "super_admin" || target.role === "super_admin") && actor.role !== "super_admin") {
    throw new ForbiddenError("Only a super admin can manage super admin roles");
  }
  const newStatus = (input.status ?? target.status) as UserStatus;

  // Guard: prevent demoting/suspending/deleting the LAST active super admin.
  if (target.role === "super_admin" && (newRole !== "super_admin" || newStatus !== "active")) {
    await ensureNotLastSuperAdmin(env);
  }
  if (newRole !== target.role) {
    await logActivity(env, c, actor, "user.role_change", `Changed role of ${target.email}: ${target.role} → ${newRole}`, "user", target.id);
  }
  await usersRepo.update(env.DB, targetId, {
    full_name: input.full_name,
    role_id: input.role ? await usersRepo.getRoleId(env.DB, input.role) : undefined,
    status: input.status,
  });
  await logActivity(env, c, actor, "user.update", `Updated user ${target.email}`, "user", target.id);
  return usersRepo.findById(env.DB, targetId);
}

export async function deleteUser(c: Context, env: Env, actor: { id: string; email: string; role: Role }, targetId: string) {
  if (actor.id === targetId) throw new ForbiddenError("Cannot delete your own account");
  const target = await usersRepo.findById(env.DB, targetId);
  if (!target) throw new NotFoundError("User not found");
  if (ROLE_HIERARCHY[actor.role] < ROLE_HIERARCHY[target.role as Role]) {
    throw new ForbiddenError("Cannot delete a higher-privileged account");
  }
  if (target.role === "super_admin") {
    if (actor.role !== "super_admin") throw new ForbiddenError("Only a super admin can delete a super admin");
    await ensureNotLastSuperAdmin(env);
  }
  await usersRepo.softDelete(env.DB, targetId);
  await logActivity(env, c, actor, "user.delete", `Deleted user ${target.email}`, "user", targetId);
}

async function ensureNotLastSuperAdmin(env: Env): Promise<void> {
  const count = await usersRepo.countActiveSuperAdmins(env.DB);
  if (count <= 1) {
    throw new ForbiddenError("Cannot remove the last active super admin");
  }
}

function logActivity(
  env: Env, c: Context, actor: { id: string; email: string },
  action: string, description: string, targetType: string, targetId: string,
) {
  return activitiesRepo.log(env.DB, {
    id: uuid(), actorId: actor.id, actorEmail: actor.email, action, category: "user",
    description, targetType, targetId, ip: clientIp(c), userAgent: c.req.header("user-agent") ?? null,
  });
}
