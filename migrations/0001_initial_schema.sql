-- 0001: Core schema — roles, users, sessions, profiles
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,              -- 'super_admin' | 'admin' | 'manager' | 'user'
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                    -- UUID
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,            -- PBKDF2-SHA256 encoded string (never plaintext)
  full_name TEXT NOT NULL,
  role_id INTEGER NOT NULL REFERENCES roles(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','suspended')),
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,                        -- soft deletion
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_deleted ON users(deleted_at);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,                    -- random session id
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,        -- SHA-256 of session token (never store raw token)
  ip_address TEXT,
  user_agent TEXT,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,                        -- explicit revocation (logout)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);

CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY,                    -- same as users.id
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT,
  bio TEXT,
  avatar_key TEXT,                        -- R2 object key (profile images)
  timezone TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed roles (idempotent)
INSERT OR IGNORE INTO roles (id, name, description) VALUES
  (1, 'super_admin', 'Full unrestricted access'),
  (2, 'admin',       'Administrative access'),
  (3, 'manager',     'Operational access'),
  (4, 'user',        'Basic user access');
