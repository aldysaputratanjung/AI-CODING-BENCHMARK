// Shared Zod schemas + TS types — used by BOTH server (validation) and client (forms).
// Single source of truth for API contracts.

import { z } from "zod";

export const ROLES = ["super_admin", "admin", "manager", "user"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_HIERARCHY: Record<Role, number> = {
  super_admin: 4,
  admin: 3,
  manager: 2,
  user: 1,
};

export const USER_STATUSES = ["active", "inactive", "suspended"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const TRANSACTION_STATUSES = ["pending", "completed", "failed", "refunded"] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const CURRENCIES = ["USD", "EUR", "IDR", "JPY", "GBP"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Minimum role required for a permission. Enforced server-side. */
export const PERMISSIONS = {
  users: {
    read: "manager" as Role,
    create: "admin" as Role,
    update: "admin" as Role,
    delete: "admin" as Role,
    assignSuperAdmin: "super_admin" as Role,
  },
  transactions: {
    read: "manager" as Role,
    create: "manager" as Role,
    update: "admin" as Role,
    delete: "admin" as Role,
  },
  activities: {
    read: "admin" as Role,
  },
  dashboard: {
    read: "manager" as Role,
  },
} as const;

// ---------- Auth ----------
export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(128)
  .regex(/[a-z]/, "Must contain a lowercase letter")
  .regex(/[A-Z]/, "Must contain an uppercase letter")
  .regex(/[0-9]/, "Must contain a number");

export const registerSchema = z.object({
  email: z.string().email().max(254),
  password: passwordSchema,
  full_name: z.string().min(2).max(100),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

// ---------- Users ----------
export const createUserSchema = z.object({
  email: z.string().email().max(254),
  password: passwordSchema,
  full_name: z.string().min(2).max(100),
  role: z.enum(ROLES),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
  .object({
    full_name: z.string().min(2).max(100).optional(),
    role: z.enum(ROLES).optional(),
    status: z.enum(USER_STATUSES).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field required" });
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// ---------- Transactions ----------
export const createTransactionSchema = z.object({
  customer_name: z.string().min(2).max(200),
  customer_email: z.string().email().max(254).optional(),
  /** Major units (e.g. dollars). Converted to integer minor units server-side. */
  amount: z.number().nonnegative().max(1_000_000_000),
  currency: z.enum(CURRENCIES),
  category_id: z.number().int().positive(),
  status: z.enum(TRANSACTION_STATUSES),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  note: z.string().max(1000).optional(),
});
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

export const updateTransactionSchema = createTransactionSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: "At least one field required" },
);
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;

// ---------- API responses ----------
export interface UserDTO {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  status: UserStatus;
  avatar_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionDTO {
  id: string;
  customer_name: string;
  customer_email: string | null;
  amount_minor: number;
  currency: string;
  category_id: number;
  category_name: string;
  status: TransactionStatus;
  payment_date: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityDTO {
  id: string;
  actor_email: string | null;
  action: string;
  category: string;
  description: string;
  target_type: string | null;
  target_id: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface SessionUser {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  status: UserStatus;
  avatar_key: string | null;
}

export interface PaginationMeta {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}
