// User repository — all queries use prepared statements (SQL-injection safe).

import type { Role, UserStatus } from "../../shared/schemas";
import type { UserRow } from "./types";

export interface UserListFilters {
  search?: string;
  role?: Role;
  status?: UserStatus;
}

const SELECT_USER = `
  SELECT u.id, u.email, u.full_name, u.role_id, r.name AS role, u.status,
         u.password_hash, u.failed_login_attempts, u.deleted_at,
         u.created_at, u.updated_at, p.avatar_key
  FROM users u
  JOIN roles r ON r.id = u.role_id
  LEFT JOIN user_profiles p ON p.user_id = u.id
`;

export function mapUserRow(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    role: row.role,
    status: row.status,
    avatar_key: row.avatar_key ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function findById(db: D1Database, id: string): Promise<UserRow | null> {
  const row = await db
    .prepare(`${SELECT_USER} WHERE u.id = ? AND u.deleted_at IS NULL`)
    .bind(id)
    .first<UserRow>();
  return row ?? null;
}

export async function findByEmail(db: D1Database, email: string): Promise<UserRow | null> {
  const row = await db
    .prepare(`${SELECT_USER} WHERE u.email = ? AND u.deleted_at IS NULL`)
    .bind(email)
    .first<UserRow>();
  return row ?? null;
}

export async function countActiveSuperAdmins(db: D1Database): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM users u
       WHERE u.role_id = (SELECT id FROM roles WHERE name = 'super_admin')
         AND u.status = 'active' AND u.deleted_at IS NULL`,
    )
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function list(
  db: D1Database,
  filters: UserListFilters,
  page: number,
  pageSize: number,
): Promise<{ rows: UserRow[]; total: number }> {
  const where: string[] = ["u.deleted_at IS NULL"];
  const params: unknown[] = [];
  if (filters.search) {
    where.push("(u.email LIKE ? OR u.full_name LIKE ?)");
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }
  if (filters.role) {
    where.push("r.name = ?");
    params.push(filters.role);
  }
  if (filters.status) {
    where.push("u.status = ?");
    params.push(filters.status);
  }
  const whereSql = `WHERE ${where.join(" AND ")}`;
  const totalRow = await db
    .prepare(`SELECT COUNT(*) AS n FROM users u JOIN roles r ON r.id = u.role_id ${whereSql}`)
    .bind(...params)
    .first<{ n: number }>();
  const rows = await db
    .prepare(
      `${SELECT_USER} ${whereSql} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
    )
    .bind(...params, pageSize, (page - 1) * pageSize)
    .all<UserRow>();
  return { rows: rows.results ?? [], total: totalRow?.n ?? 0 };
}

export async function create(
  db: D1Database,
  data: { id: string; email: string; passwordHash: string; full_name: string; roleId: number },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO users (id, email, password_hash, full_name, role_id) VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(data.id, data.email, data.passwordHash, data.full_name, data.roleId)
    .run();
  await db.prepare(`INSERT INTO user_profiles (id, user_id) VALUES (?, ?)`).bind(data.id, data.id).run();
}

export async function update(
  db: D1Database,
  id: string,
  fields: { full_name?: string; role_id?: number; status?: UserStatus },
): Promise<void> {
  const sets: string[] = ["updated_at = datetime('now')"];
  const params: unknown[] = [];
  if (fields.full_name !== undefined) { sets.push("full_name = ?"); params.push(fields.full_name); }
  if (fields.role_id !== undefined) { sets.push("role_id = ?"); params.push(fields.role_id); }
  if (fields.status !== undefined) { sets.push("status = ?"); params.push(fields.status); }
  await db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).bind(...params, id).run();
}

export async function softDelete(db: D1Database, id: string): Promise<void> {
  await db
    .prepare(`UPDATE users SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`)
    .bind(id)
    .run();
}

export async function recordFailedLogin(db: D1Database, userId: string, attempts: number): Promise<void> {
  await db
    .prepare(`UPDATE users SET failed_login_attempts = ? WHERE id = ?`)
    .bind(attempts, userId)
    .run();
}

export async function resetFailedLogins(db: D1Database, userId: string): Promise<void> {
  await db
    .prepare(`UPDATE users SET failed_login_attempts = 0 WHERE id = ?`)
    .bind(userId)
    .run();
}

export async function countAllActive(db: D1Database): Promise<number> {
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM users WHERE deleted_at IS NULL AND status = 'active'`)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export const roleIdCache = new Map<string, number>();
export async function getRoleId(db: D1Database, role: Role): Promise<number> {
  const cached = roleIdCache.get(role);
  if (cached) return cached;
  const row = await db.prepare(`SELECT id FROM roles WHERE name = ?`).bind(role).first<{ id: number }>();
  if (!row) throw new Error(`Unknown role: ${role}`);
  roleIdCache.set(role, row.id);
  return row.id;
}
