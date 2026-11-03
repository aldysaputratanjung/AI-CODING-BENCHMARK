// /api/v1/transactions — CRUD + filtering (manager read/create, admin update/delete).

import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../types";
import type { SessionUser } from "../../shared/schemas";
import { TRANSACTION_STATUSES, createTransactionSchema, updateTransactionSchema } from "../../shared/schemas";
import * as txRepo from "../repositories/transactions";
import { ValidationError, NotFoundError } from "../errors";
import { requirePermission } from "../middleware";
import { uuid, clientIp } from "../utils/auth";
import * as activitiesRepo from "../repositories/activities";

const transactions = new Hono<{ Bindings: Env; Variables: { user: SessionUser } }>();

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
  status: z.enum(TRANSACTION_STATUSES).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  category_id: z.coerce.number().int().positive().optional(),
});

function paginationMeta(page: number, pageSize: number, total: number) {
  return { page, page_size: pageSize, total, total_pages: Math.ceil(total / pageSize) };
}

/** Converts major-unit float (from JSON) to integer minor units safely. */
export function toMinorUnits(amount: number, currency: string): number {
  const zeroDecimal = currency === "JPY" || currency === "IDR";
  return zeroDecimal ? Math.round(amount) : Math.round(amount * 100);
}

transactions.use("*", requirePermission("transactions", "read"));

transactions.get("/", async (c) => {
  const q = listQuery.safeParse({
    page: c.req.query("page"),
    page_size: c.req.query("page_size"),
    search: c.req.query("search") || undefined,
    status: c.req.query("status") || undefined,
    from: c.req.query("from") || undefined,
    to: c.req.query("to") || undefined,
    category_id: c.req.query("category_id") || undefined,
  });
  if (!q.success) throw new ValidationError(q.error.flatten());
  const { rows, total } = await txRepo.list(c.env.DB, q.data, q.data.page, q.data.page_size);
  return c.json({ transactions: rows.map(txRepo.mapTxRow), pagination: paginationMeta(q.data.page, q.data.page_size, total) });
});

transactions.get("/categories", async (c) => {
  const rows = await c.env.DB
    .prepare(`SELECT id, name, description FROM transaction_categories ORDER BY id`)
    .all<{ id: number; name: string; description: string }>();
  return c.json({ categories: rows.results ?? [] });
});

transactions.get("/:id", async (c) => {
  const tx = await txRepo.findById(c.env.DB, c.req.param("id") ?? "");
  if (!tx) throw new NotFoundError("Transaction not found");
  return c.json({ transaction: txRepo.mapTxRow(tx) });
});

transactions.post("/", requirePermission("transactions", "create"), async (c) => {
  const input = createTransactionSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) throw new ValidationError(input.error.flatten());
  const data = input.data;
  const id = uuid();
  await txRepo.create(c.env.DB, {
    id,
    customer_name: data.customer_name,
    customer_email: data.customer_email ?? null,
    amount_minor: toMinorUnits(data.amount, data.currency),
    currency: data.currency,
    category_id: data.category_id,
    status: data.status,
    payment_date: data.payment_date,
    note: data.note ?? null,
  });
  await activitiesRepo.log(c.env.DB, {
    id: uuid(), actorId: c.get("user").id, actorEmail: c.get("user").email,
    action: "transaction.create", category: "transaction",
    description: `Created transaction ${id} (${data.currency} ${data.amount})`,
    targetType: "transaction", targetId: id, ip: clientIp(c), userAgent: c.req.header("user-agent") ?? null,
  });
  const created = await txRepo.findById(c.env.DB, id);
  return c.json({ transaction: txRepo.mapTxRow(created!) }, 201);
});

transactions.put("/:id", requirePermission("transactions", "update"), async (c) => {
  const existing = await txRepo.findById(c.env.DB, c.req.param("id") ?? "");
  if (!existing) throw new NotFoundError("Transaction not found");
  const input = updateTransactionSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) throw new ValidationError(input.error.flatten());
  const fields: Record<string, unknown> = { ...input.data };
  if (input.data.amount !== undefined) {
    fields.amount_minor = toMinorUnits(input.data.amount, (input.data.currency ?? existing.currency));
    delete fields.amount;
  }
  await txRepo.update(c.env.DB, existing.id, fields);
  await activitiesRepo.log(c.env.DB, {
    id: uuid(), actorId: c.get("user").id, actorEmail: c.get("user").email,
    action: "transaction.update", category: "transaction",
    description: `Updated transaction ${existing.id}`,
    targetType: "transaction", targetId: existing.id, ip: clientIp(c), userAgent: c.req.header("user-agent") ?? null,
  });
  const updated = await txRepo.findById(c.env.DB, existing.id);
  return c.json({ transaction: txRepo.mapTxRow(updated!) });
});

transactions.delete("/:id", requirePermission("transactions", "delete"), async (c) => {
  const existing = await txRepo.findById(c.env.DB, c.req.param("id") ?? "");
  if (!existing) throw new NotFoundError("Transaction not found");
  await txRepo.softDelete(c.env.DB, existing.id);
  await activitiesRepo.log(c.env.DB, {
    id: uuid(), actorId: c.get("user").id, actorEmail: c.get("user").email,
    action: "transaction.delete", category: "transaction",
    description: `Deleted transaction ${existing.id}`,
    targetType: "transaction", targetId: existing.id, ip: clientIp(c), userAgent: c.req.header("user-agent") ?? null,
  });
  return c.json({ ok: true });
});

export default transactions;
