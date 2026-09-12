import crypto from "crypto";
import { db } from "@/lib/db";
import { getAllSettings, setSetting, toInt, toBool } from "./settings";

// ---------------------------------------------------------------------------
// Admin authentication
// ---------------------------------------------------------------------------
// Password is stored as a scrypt hash in the Setting table (key admin.passwordHash).
// Sessions use a signed httpOnly cookie `lan_admin` containing a HMAC token with
// an embedded "last activity" timestamp (sliding inactivity window).

const COOKIE_NAME = "lan_admin";
const DEFAULT_PASSWORD = "admin";

// scrypt parameters — reasonably strong, fast enough for an admin panel.
const SCRYPT_KEYLEN = 32;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

function sign(payload: string): string {
  const secret = process.env.ADMIN_SESSION_SECRET || "lan-share-admin-secret-v1";
  const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${hmac}`;
}

function verify(signed: string): string | null {
  const idx = signed.lastIndexOf(".");
  if (idx < 1) return null;
  const payload = signed.slice(0, idx);
  const sig = signed.slice(idx + 1);
  const expected = crypto
    .createHmac("sha256", process.env.ADMIN_SESSION_SECRET || "lan-share-admin-secret-v1")
    .update(payload)
    .digest("hex");
  // timing-safe compare
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;
  return payload;
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto
    .scryptSync(password, salt, SCRYPT_KEYLEN, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
    })
    .toString("hex");
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(password: string, stored: string): boolean {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = parts[1];
  const expected = parts[2];
  const derived = crypto
    .scryptSync(password, salt, SCRYPT_KEYLEN, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
    })
    .toString("hex");
  const a = Buffer.from(derived, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Ensure a password hash exists; seed the default on first access.
export async function ensurePasswordSeed(): Promise<void> {
  const s = await getAllSettings();
  if (!s["admin.passwordHash"]) {
    await setSetting("admin.passwordHash", hashPassword(DEFAULT_PASSWORD));
  }
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  await ensurePasswordSeed();
  const s = await getAllSettings();
  return verifyPassword(password, s["admin.passwordHash"] || "");
}

export async function setAdminPassword(newPassword: string): Promise<void> {
  await setSetting("admin.passwordHash", hashPassword(newPassword));
  await setSetting("admin.passwordChanged", "true");
}

export async function isDefaultPasswordInUse(): Promise<boolean> {
  const s = await getAllSettings();
  return toBool(s["admin.passwordChanged"]) === false;
}

// ---------------------------------------------------------------------------
// Session cookie helpers
// ---------------------------------------------------------------------------

interface SessionPayload {
  token: string; // random per-login
  issuedAt: number; // ms — login time
  lastActivity: number; // ms — sliding window
}

export function getInactivityMs(): Promise<number> {
  return getAllSettings().then((s) =>
    Math.max(1, toInt(s["security.adminInactivityMin"], 30)) * 60 * 1000
  );
}

// Create a signed session cookie value for a fresh login.
export function createSessionCookie(): string {
  const now = Date.now();
  const payload: SessionPayload = {
    token: crypto.randomBytes(24).toString("hex"),
    issuedAt: now,
    lastActivity: now,
  };
  return sign(JSON.stringify(payload));
}

// Verify + decode a session cookie value. Returns the (renewed) payload if
// still valid, or null if expired/invalid. Also returns a fresh signed value
// with an updated lastActivity timestamp (sliding window).
export async function validateSession(
  cookieValue: string | undefined | null
): Promise<{ payload: SessionPayload; renewedCookie: string } | null> {
  if (!cookieValue) return null;
  const payloadStr = verify(cookieValue);
  if (!payloadStr) return null;
  let payload: SessionPayload;
  try {
    payload = JSON.parse(payloadStr);
  } catch {
    return null;
  }
  if (!payload.token || !payload.issuedAt || !payload.lastActivity) return null;

  const inactivityMs = await getInactivityMs();
  const now = Date.now();
  if (now - payload.lastActivity > inactivityMs) return null;

  // Slide the window forward.
  const renewed: SessionPayload = { ...payload, lastActivity: now };
  return { payload: renewed, renewedCookie: sign(JSON.stringify(renewed)) };
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;

// Parse the admin cookie out of a Request's Cookie header.
export function readAdminCookie(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie") || "";
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === COOKIE_NAME) return decodeURIComponent(rest.join("="));
  }
  return null;
}

// Middleware-like guard for admin API routes. Returns the renewed cookie to
// set on the response, or null if not authenticated.
export async function requireAdmin(
  request: Request
): Promise<{ renewedCookie: string } | null> {
  const cookie = readAdminCookie(request);
  const session = await validateSession(cookie);
  return session ? { renewedCookie: session.renewedCookie } : null;
}

// ---------------------------------------------------------------------------
// Audit logging
// ---------------------------------------------------------------------------

export async function logAdminAction(
  action: string,
  detail = "",
  actor = "admin"
): Promise<void> {
  try {
    await db.adminLog.create({ data: { action, detail, actor } });
  } catch {
    /* ignore */
  }
}
