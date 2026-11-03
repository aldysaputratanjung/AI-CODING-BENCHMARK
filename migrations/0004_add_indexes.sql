-- 0004: Additional analytical indexes
CREATE INDEX IF NOT EXISTS idx_tx_customer ON transactions(customer_name);
CREATE INDEX IF NOT EXISTS idx_tx_status_date ON transactions(status, payment_date);
CREATE INDEX IF NOT EXISTS idx_logs_action ON activity_logs(action);
