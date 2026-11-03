// Activity log repository (audit trail).

import type { ActivityRow } from "./types";

export async function log(db: D1Database, data: {
  id: string; actorId: string | null; actorEmail: string | null; action: string;
  category: string; description: string; targetType: string | null; targetId: string | null;
  ip: string | null; userAgent: string | null;
}): Promise<void> {
  await db
    .prepare(
      `INSERT INTO activity_logs (id, actor_id, actor_email, action, category, description, target_type, target_id, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(data.id, data.actorId, data.actorEmail, data.action, data.category,
          data.description, data.targetType, data.targetId, data.ip, data.userAgent)
    .run();
}

export interface ActivityFilters {
  category?: string;
  actorId?: string;
}

function buildWhere(filters: ActivityFilters): { whereSql: string; params: unknown[] } {
  const where: string[] = ["1=1"];
  const params: unknown[] = [];
  if (filters.category) { where.push("category = ?"); params.push(filters.category); }
  if (filters.actorId) { where.push("actor_id = ?"); params.push(filters.actorId); }
  return { whereSql: `WHERE ${where.join(" AND ")}`, params };
}

export async function list(
  db: D1Database,
  filters: ActivityFilters,
  page: number,
  pageSize: number,
): Promise<{ rows: ActivityRow[]; total: number }> {
  const { whereSql, params } = buildWhere(filters);
  const totalRow = await db
    .prepare(`SELECT COUNT(*) AS n FROM activity_logs ${whereSql}`)
    .bind(...params)
    .first<{ n: number }>();
  const rows = await db
    .prepare(`SELECT * FROM activity_logs ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .bind(...params, pageSize, (page - 1) * pageSize)
    .all<ActivityRow>();
  return { rows: rows.results ?? [], total: totalRow?.n ?? 0 };
}

export async function findById(db: D1Database, id: string): Promise<ActivityRow | null> {
  return (await db.prepare(`SELECT * FROM activity_logs WHERE id = ?`).bind(id).first<ActivityRow>()) ?? null;
}

export async function recent(db: D1Database, limit: number): Promise<ActivityRow[]> {
  const rows = await db
    .prepare(`SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT ?`)
    .bind(limit)
    .all<ActivityRow>();
  return rows.results ?? [];
}
