// Analytics service — all metrics computed from real D1 records.
// Revenue counts ONLY 'completed' transactions.

import type { Env } from "../types";
import * as txRepo from "../repositories/transactions";
import * as usersRepo from "../repositories/users";

export interface DateRange { from: string; to: string }

/** Splits a range [from, to] into current vs previous equal-length period. */
export function splitComparison(range: DateRange): { current: DateRange; previous: DateRange } {
  const from = new Date(range.from + "T00:00:00Z");
  const to = new Date(range.to + "T00:00:00Z");
  const spanMs = Math.max(to.getTime() - from.getTime(), 86400000);
  const prevTo = new Date(from.getTime() - 86400000);
  const prevFrom = new Date(prevTo.getTime() - spanMs);
  return {
    current: range,
    previous: { from: prevFrom.toISOString().slice(0, 10), to: prevTo.toISOString().slice(0, 10) },
  };
}

export async function summary(env: Env, range: DateRange) {
  const { current, previous } = splitComparison(range);
  const [cur, prev, totalUsers, activeUsers] = await Promise.all([
    txRepo.revenueSummary(env.DB, current.from, current.to),
    txRepo.revenueSummary(env.DB, previous.from, previous.to),
    countTotalUsers(env.DB),
    usersRepo.countAllActive(env.DB),
  ]);
  const growthPct = prev.totalMinor > 0
    ? ((cur.totalMinor - prev.totalMinor) / prev.totalMinor) * 100
    : null;
  return {
    total_revenue_minor: cur.totalMinor,
    previous_revenue_minor: prev.totalMinor,
    revenue_growth_pct: growthPct,
    transaction_count: cur.count,
    average_transaction_minor: cur.avgMinor,
    total_users: totalUsers,
    active_users: activeUsers,
    range: { from: current.from, to: current.to },
  };
}

async function countTotalUsers(db: D1Database): Promise<number> {
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM users WHERE deleted_at IS NULL`).first<{ n: number }>();
  return row?.n ?? 0;
}

export async function revenueCharts(env: Env, range: DateRange) {
  const [byDay, byMonth, byCategory, statusDist] = await Promise.all([
    txRepo.revenueByDay(env.DB, range.from, range.to),
    txRepo.revenueByMonth(env.DB, range.from, range.to),
    txRepo.revenueByCategory(env.DB, range.from, range.to),
    txRepo.statusDistribution(env.DB, range.from, range.to),
  ]);
  return { by_day: byDay, by_month: byMonth, by_category: byCategory, status_distribution: statusDist };
}

export async function userStats(env: Env, range: DateRange) {
  const registrations = await txRepo.userRegistrations(env.DB, range.from, range.to);
  return { registrations };
}

/** Month-over-month revenue comparison for the last 12 months. */
export async function monthlyComparison(env: Env): Promise<{ month: string; revenue_minor: number }[]> {
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  return txRepo.revenueByMonth(env.DB, from, to);
}
