// Transaction repository — prepared statements only; amounts are integer minor units.

import type { TransactionStatus } from "../../shared/schemas";
import type { TransactionRow } from "./types";

export interface TransactionFilters {
  search?: string;
  status?: TransactionStatus;
  category_id?: number;
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
}

const SELECT_TX = `
  SELECT t.id, t.customer_name, t.customer_email, t.amount_minor, t.currency,
         t.category_id, c.name AS category_name, t.status, t.payment_date,
         t.note, t.deleted_at, t.created_at, t.updated_at
  FROM transactions t
  JOIN transaction_categories c ON c.id = t.category_id
`;

export function mapTxRow(row: TransactionRow) {
  return {
    id: row.id,
    customer_name: row.customer_name,
    customer_email: row.customer_email,
    amount_minor: row.amount_minor,
    currency: row.currency,
    category_id: row.category_id,
    category_name: row.category_name,
    status: row.status,
    payment_date: row.payment_date,
    note: row.note,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function buildWhere(filters: TransactionFilters): { whereSql: string; params: unknown[] } {
  const where: string[] = ["t.deleted_at IS NULL"];
  const params: unknown[] = [];
  if (filters.search) {
    where.push("(t.customer_name LIKE ? OR t.id LIKE ?)");
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }
  if (filters.status) { where.push("t.status = ?"); params.push(filters.status); }
  if (filters.category_id) { where.push("t.category_id = ?"); params.push(filters.category_id); }
  if (filters.from) { where.push("t.payment_date >= ?"); params.push(filters.from); }
  if (filters.to) { where.push("t.payment_date <= ?"); params.push(filters.to); }
  return { whereSql: `WHERE ${where.join(" AND ")}`, params };
}

export async function list(
  db: D1Database,
  filters: TransactionFilters,
  page: number,
  pageSize: number,
): Promise<{ rows: TransactionRow[]; total: number }> {
  const { whereSql, params } = buildWhere(filters);
  const totalRow = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM transactions t JOIN transaction_categories c ON c.id = t.category_id ${whereSql}`,
    )
    .bind(...params)
    .first<{ n: number }>();
  const rows = await db
    .prepare(`${SELECT_TX} ${whereSql} ORDER BY t.payment_date DESC, t.created_at DESC LIMIT ? OFFSET ?`)
    .bind(...params, pageSize, (page - 1) * pageSize)
    .all<TransactionRow>();
  return { rows: rows.results ?? [], total: totalRow?.n ?? 0 };
}

export async function findById(db: D1Database, id: string): Promise<TransactionRow | null> {
  const row = await db.prepare(`${SELECT_TX} WHERE t.id = ? AND t.deleted_at IS NULL`).bind(id).first<TransactionRow>();
  return row ?? null;
}

export async function create(
  db: D1Database,
  data: {
    id: string; customer_name: string; customer_email: string | null;
    amount_minor: number; currency: string; category_id: number;
    status: string; payment_date: string; note: string | null;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO transactions (id, customer_name, customer_email, amount_minor, currency, category_id, status, payment_date, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      data.id, data.customer_name, data.customer_email, data.amount_minor,
      data.currency, data.category_id, data.status, data.payment_date, data.note,
    )
    .run();
}

export async function update(db: D1Database, id: string, fields: Partial<Record<string, unknown>>): Promise<void> {
  const map: Record<string, string> = {
    customer_name: "customer_name", customer_email: "customer_email", amount_minor: "amount_minor",
    currency: "currency", category_id: "category_id", status: "status", payment_date: "payment_date", note: "note",
  };
  const sets = ["updated_at = datetime('now')"];
  const params: unknown[] = [];
  for (const [key, col] of Object.entries(map)) {
    if (fields[key] !== undefined) { sets.push(`${col} = ?`); params.push(fields[key]); }
  }
  await db.prepare(`UPDATE transactions SET ${sets.join(", ")} WHERE id = ?`).bind(...params, id).run();
}

export async function softDelete(db: D1Database, id: string): Promise<void> {
  await db
    .prepare(`UPDATE transactions SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`)
    .bind(id)
    .run();
}

// ---------- Aggregations (dashboard) ----------
// Revenue = completed transactions only (pending/failed/refunded excluded).

const REVENUE_WHERE = `t.deleted_at IS NULL AND t.status = 'completed'`;

export async function revenueSummary(db: D1Database, from: string, to: string): Promise<{
  totalMinor: number; count: number; avgMinor: number;
}> {
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(amount_minor),0) AS total, COUNT(*) AS n
       FROM transactions t WHERE ${REVENUE_WHERE} AND payment_date BETWEEN ? AND ?`,
    )
    .bind(from, to)
    .first<{ total: number; n: number }>();
  const totalMinor = row?.total ?? 0;
  const count = row?.n ?? 0;
  return { totalMinor, count, avgMinor: count > 0 ? Math.round(totalMinor / count) : 0 };
}

export async function revenueByDay(db: D1Database, from: string, to: string): Promise<{ day: string; revenue_minor: number }[]> {
  const rows = await db
    .prepare(
      `SELECT payment_date AS day, SUM(amount_minor) AS revenue_minor
       FROM transactions t WHERE ${REVENUE_WHERE} AND payment_date BETWEEN ? AND ?
       GROUP BY payment_date ORDER BY day`,
    )
    .bind(from, to)
    .all<{ day: string; revenue_minor: number }>();
  return rows.results ?? [];
}

export async function revenueByMonth(db: D1Database, from: string, to: string): Promise<{ month: string; revenue_minor: number }[]> {
  const rows = await db
    .prepare(
      `SELECT strftime('%Y-%m', payment_date) AS month, SUM(amount_minor) AS revenue_minor
       FROM transactions t WHERE ${REVENUE_WHERE} AND payment_date BETWEEN ? AND ?
       GROUP BY month ORDER BY month`,
    )
    .bind(from, to)
    .all<{ month: string; revenue_minor: number }>();
  return rows.results ?? [];
}

export async function revenueByCategory(db: D1Database, from: string, to: string): Promise<{ category_id: number; category_name: string; revenue_minor: number }[]> {
  const rows = await db
    .prepare(
      `SELECT t.category_id, c.name AS category_name, SUM(t.amount_minor) AS revenue_minor
       FROM transactions t JOIN transaction_categories c ON c.id = t.category_id
       WHERE ${REVENUE_WHERE} AND payment_date BETWEEN ? AND ?
       GROUP BY t.category_id, c.name ORDER BY revenue_minor DESC`,
    )
    .bind(from, to)
    .all<{ category_id: number; category_name: string; revenue_minor: number }>();
  return rows.results ?? [];
}

export async function statusDistribution(db: D1Database, from: string, to: string): Promise<{ status: string; count: number }[]> {
  const rows = await db
    .prepare(
      `SELECT status, COUNT(*) AS count FROM transactions t
       WHERE t.deleted_at IS NULL AND payment_date BETWEEN ? AND ? GROUP BY status`,
    )
    .bind(from, to)
    .all<{ status: string; count: number }>();
  return rows.results ?? [];
}

export async function userRegistrations(db: D1Database, from: string, to: string): Promise<{ day: string; count: number }[]> {
  const rows = await db
    .prepare(
      `SELECT date(created_at) AS day, COUNT(*) AS count FROM users
       WHERE deleted_at IS NULL AND date(created_at) BETWEEN ? AND ? GROUP BY day ORDER BY day`,
    )
    .bind(from, to)
    .all<{ day: string; count: number }>();
  return rows.results ?? [];
}
