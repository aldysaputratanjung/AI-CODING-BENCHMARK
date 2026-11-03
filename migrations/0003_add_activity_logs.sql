-- 0003: Activity logs (audit trail)
CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,                    -- UUID
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor_email TEXT,                        -- denormalized snapshot (survives user deletion)
  action TEXT NOT NULL,                   -- e.g. 'auth.login', 'user.create'
  category TEXT NOT NULL CHECK (category IN ('auth','user','transaction','system')),
  description TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_logs_actor ON activity_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_logs_category ON activity_logs(category);
CREATE INDEX IF NOT EXISTS idx_logs_created ON activity_logs(created_at);
