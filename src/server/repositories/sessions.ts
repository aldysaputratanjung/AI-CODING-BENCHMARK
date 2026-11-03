// Session repository — D1-backed persistent sessions (token stored hashed).

import { SESSION_TTL } from "../utils/auth";
import type { SessionRow } from "./types";

export async function create(
  db: D1Database,
  data: { id: string; userId: string; tokenHash: string; ip: string | null; userAgent: string | null },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO user_sessions (id, user_id, token_hash, ip_address, user_agent, expires_at)
       VALUES (?, ?, ?, ?, ?, datetime('now', '+' || ? || ' seconds'))`,
    )
    .bind(data.id, data.userId, data.tokenHash, data.ip, data.userAgent, String(SESSION_TTL))
    .run();
}

export async function findValidByTokenHash(db: D1Database, tokenHash: string): Promise<SessionRow | null> {
  const row = await db
    .prepare(
      `SELECT * FROM user_sessions
       WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > datetime('now')`,
    )
    .bind(tokenHash)
    .first<SessionRow>();
  return row ?? null;
}

export async function revoke(db: D1Database, id: string): Promise<void> {
  await db.prepare(`UPDATE user_sessions SET revoked_at = datetime('now') WHERE id = ?`).bind(id).run();
}

export async function revokeAllForUser(db: D1Database, userId: string): Promise<void> {
  await db
    .prepare(`UPDATE user_sessions SET revoked_at = datetime('now') WHERE user_id = ? AND revoked_at IS NULL`)
    .bind(userId)
    .run();
}
