// Row-level types returned by D1 queries (snake_case DB columns).

export interface UserRow {
  id: string;
  email: string;
  full_name: string;
  role_id: number;
  role: string;
  status: string;
  password_hash: string;
  failed_login_attempts: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  avatar_key: string | null;
}

export interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  ip_address: string | null;
  user_agent: string | null;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
}

export interface TransactionRow {
  id: string;
  customer_name: string;
  customer_email: string | null;
  amount_minor: number;
  currency: string;
  category_id: number;
  category_name: string;
  status: string;
  payment_date: string;
  note: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityRow {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  category: string;
  description: string;
  target_type: string | null;
  target_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}
