import { describe, it, expect } from "vitest";
import {
  registerSchema,
  loginSchema,
  createUserSchema,
  createTransactionSchema,
  updateTransactionSchema,
  PERMISSIONS,
  ROLE_HIERARCHY,
} from "@shared/schemas";

describe("auth schemas", () => {
  it("accepts a valid registration", () => {
    const r = registerSchema.safeParse({
      email: "user@example.com",
      password: "Str0ngPass123",
      full_name: "Aldy",
    });
    expect(r.success).toBe(true);
  });

  it("rejects invalid email / weak password (min 10, upper+lower+digit)", () => {
    expect(registerSchema.safeParse({ email: "not-an-email", password: "Str0ngPass123", full_name: "x" }).success).toBe(false);
    expect(registerSchema.safeParse({ email: "a@b.co", password: "short1A", full_name: "x" }).success).toBe(false);
    expect(registerSchema.safeParse({ email: "a@b.co", password: "alllowercase1", full_name: "x" }).success).toBe(false);
  });

  it("requires full_name of sane length", () => {
    expect(registerSchema.safeParse({ email: "a@b.co", password: "Str0ngPass123", full_name: "A" }).success).toBe(false);
    expect(registerSchema.safeParse({ email: "a@b.co", password: "Str0ngPass123", full_name: "x".repeat(101) }).success).toBe(false);
  });

  it("login requires email + non-empty password", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
  });
});

describe("user management schemas", () => {
  it("createUser enforces role enum (status is set server-side at create)", () => {
    expect(createUserSchema.safeParse({
      email: "x@y.co", password: "Str0ngPass123", full_name: "Xy", role: "admin",
    }).success).toBe(true);
    expect(createUserSchema.safeParse({
      email: "x@y.co", password: "Str0ngPass123", full_name: "Xy", role: "hacker",
    }).success).toBe(false);
  });
});

describe("transaction schemas", () => {
  const valid = {
    customer_name: "Acme Corp",
    customer_email: "billing@acme.co",
    amount: 12.34,
    currency: "USD",
    category_id: 1,
    status: "completed",
    payment_date: "2026-01-01",
    note: "Sale",
  };

  it("accepts a valid transaction", () => {
    expect(createTransactionSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects negative amounts and bad currency", () => {
    expect(createTransactionSchema.safeParse({ ...valid, amount: -5 }).success).toBe(false);
    expect(createTransactionSchema.safeParse({ ...valid, currency: "XXX" }).success).toBe(false);
  });

  it("rejects malformed payment_date (must be YYYY-MM-DD)", () => {
    expect(createTransactionSchema.safeParse({ ...valid, payment_date: "01-01-2026" }).success).toBe(false);
  });

  it("rejects non-integer category_id", () => {
    expect(createTransactionSchema.safeParse({ ...valid, category_id: 1.5 }).success).toBe(false);
  });

  it("update schema allows partial but re-validates enums", () => {
    expect(updateTransactionSchema.safeParse({ status: "refunded" }).success).toBe(true);
    expect(updateTransactionSchema.safeParse({ status: "nope" }).success).toBe(false);
    expect(updateTransactionSchema.safeParse({}).success).toBe(false);
  });
});

describe("RBAC permission matrix", () => {
  it("users CRUD requires admin; super_admin grant is super_admin-only", () => {
    expect(PERMISSIONS.users.create).toBe("admin");
    expect(PERMISSIONS.users.delete).toBe("admin");
    expect(PERMISSIONS.users.assignSuperAdmin).toBe("super_admin");
  });

  it("role hierarchy strictly orders roles", () => {
    expect(ROLE_HIERARCHY.super_admin).toBeGreaterThan(ROLE_HIERARCHY.admin);
    expect(ROLE_HIERARCHY.admin).toBeGreaterThan(ROLE_HIERARCHY.manager);
    expect(ROLE_HIERARCHY.manager).toBeGreaterThan(ROLE_HIERARCHY.user);
  });
});
