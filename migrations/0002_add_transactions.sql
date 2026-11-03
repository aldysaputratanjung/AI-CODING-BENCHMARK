-- 0002: Transactions and categories. Amounts stored as INTEGER minor units (cents) — no floats.
CREATE TABLE IF NOT EXISTS transaction_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,                    -- UUID
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD','EUR','IDR','JPY','GBP')),
  category_id INTEGER NOT NULL REFERENCES transaction_categories(id),
  status TEXT NOT NULL CHECK (status IN ('pending','completed','failed','refunded')),
  payment_date TEXT NOT NULL,             -- ISO date
  note TEXT,
  deleted_at TEXT,                        -- soft deletion
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tx_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_tx_payment_date ON transactions(payment_date);
CREATE INDEX IF NOT EXISTS idx_tx_deleted ON transactions(deleted_at);

INSERT OR IGNORE INTO transaction_categories (id, name, description) VALUES
  (1, 'Subscription',  'Recurring subscription revenue'),
  (2, 'One-time',      'One-off purchases'),
  (3, 'Services',       'Professional services'),
  (4, 'Enterprise',     'Enterprise contracts'),
  (5, 'Marketplace',    'Marketplace commission');
