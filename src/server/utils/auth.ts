import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";

// ---------- IDs ----------
export function uuid(): string {
  return crypto.randomUUID();
}

// ---------- Session cookie ----------
const SESSION_COOKIE = "session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export function newSessionToken(): string {
  // Session fixation prevention: always a fresh random token.
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

export function setSessionCookie(c: Context, token: string, expires: Date) {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    expires,
  });
}

export function clearSessionCookie(c: Context) {
  setCookie(c, SESSION_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    expires: new Date(0),
  });
}

export function getSessionCookie(c: Context): string | undefined {
  return getCookie(c, SESSION_COOKIE);
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
export const SESSION_TTL = SESSION_TTL_SECONDS;

// ---------- Hashing (session tokens stored hashed) ----------
export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ---------- Client info ----------
export function clientIp(c: Context): string | null {
  return c.req.header("cf-connecting-ip") ?? null;
}

// ---------- CSRF (stateless HMAC token bound to user + timestamp) ----------
export async function makeCsrfToken(userId: string, secret: string): Promise<string> {
  const key = await hmacKey(secret);
  const ts = Date.now();
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${userId}.${ts}`));
  return `${ts}.${base64url(new Uint8Array(sig))}`;
}

export async function verifyCsrfToken(userId: string, token: string, secret: string, maxAgeMs = 60 * 60 * 1000): Promise<boolean> {
  const [tsStr, sig] = token.split(".");
  const ts = parseInt(tsStr, 10);
  if (!Number.isInteger(ts) || ts < 0 || !sig) return false;
  if (Date.now() - ts > maxAgeMs) return false;
  const expected = await crypto.subtle.sign("HMAC", await hmacKey(secret), new TextEncoder().encode(`${userId}.${ts}`));
  return timingSafeEqualStr(sig, base64url(new Uint8Array(expected)));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
