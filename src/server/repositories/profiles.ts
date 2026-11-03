// Profile repository (user_profiles + avatar in R2).

export async function getProfile(db: D1Database, userId: string) {
  const row = await db
    .prepare(
      `SELECT p.display_name, p.bio, p.avatar_key, p.timezone, p.updated_at
       FROM user_profiles p WHERE p.user_id = ?`,
    )
    .bind(userId)
    .first<{ display_name: string | null; bio: string | null; avatar_key: string | null; timezone: string | null; updated_at: string }>();
  return row ?? null;
}

export async function updateProfile(
  db: D1Database,
  userId: string,
  fields: { display_name?: string; bio?: string; timezone?: string; avatar_key?: string | null },
): Promise<void> {
  const sets = ["updated_at = datetime('now')"];
  const params: unknown[] = [];
  if (fields.display_name !== undefined) { sets.push("display_name = ?"); params.push(fields.display_name); }
  if (fields.bio !== undefined) { sets.push("bio = ?"); params.push(fields.bio); }
  if (fields.timezone !== undefined) { sets.push("timezone = ?"); params.push(fields.timezone); }
  if (fields.avatar_key !== undefined) { sets.push("avatar_key = ?"); params.push(fields.avatar_key); }
  await db.prepare(`UPDATE user_profiles SET ${sets.join(", ")} WHERE user_id = ?`).bind(...params, userId).run();
}
