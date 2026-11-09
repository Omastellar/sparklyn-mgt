import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getDb } from './db';

const SESSION_COOKIE_NAME = 'sparklyn_admin_session';
const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60; // 12 hours

// Secret used for HMAC signing of session tokens
const SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'sparklyn-fallback-internal-secret-entropy';

// Rate limiting state for brute-force protection (in-memory)
interface AttemptRecord {
  count: number;
  lockedUntil: number;
}
const loginAttempts = new Map<string, AttemptRecord>();

export function checkRateLimit(identifier: string): { allowed: boolean; waitSeconds?: number } {
  const now = Date.now();
  const record = loginAttempts.get(identifier);

  if (!record) {
    return { allowed: true };
  }

  if (record.lockedUntil > now) {
    const waitSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return { allowed: false, waitSeconds };
  }

  // Lockout expired, reset
  if (record.lockedUntil > 0 && record.lockedUntil <= now) {
    loginAttempts.delete(identifier);
    return { allowed: true };
  }

  return { allowed: true };
}

export function recordFailedAttempt(identifier: string): { locked: boolean; waitSeconds?: number } {
  const now = Date.now();
  const record = loginAttempts.get(identifier) || { count: 0, lockedUntil: 0 };
  record.count += 1;

  // Lock out after 5 consecutive failed attempts for 15 minutes
  if (record.count >= 5) {
    record.lockedUntil = now + 15 * 60 * 1000;
    loginAttempts.set(identifier, record);
    return { locked: true, waitSeconds: 15 * 60 };
  }

  loginAttempts.set(identifier, record);
  return { locked: false };
}

export function resetFailedAttempts(identifier: string): void {
  loginAttempts.delete(identifier);
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function safeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Constant time dummy check to avoid length leak
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verifies admin password securely.
 * Rejects if no ADMIN_PASSWORD is set and no hash exists in DB.
 */
export function verifyAdminPassword(password: string): boolean {
  if (!password || typeof password !== 'string') return false;

  const envPassword = process.env.ADMIN_PASSWORD;
  if (envPassword && safeCompare(password, envPassword)) {
    return true;
  }

  // Fallback to database hash if configured
  try {
    const db = getDb();
    if (db.adminPasswordHash && bcrypt.compareSync(password, db.adminPasswordHash)) {
      return true;
    }
  } catch {
    // Ignore DB read failure
  }

  return false;
}

/**
 * Creates a signed admin session token.
 */
export function createAdminSessionToken(): string {
  const timestamp = Date.now().toString();
  const randomEntropy = crypto.randomBytes(16).toString('hex');
  const payload = `${timestamp}:${randomEntropy}`;
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('hex');

  return `${payload}:${signature}`;
}

/**
 * Validates a signed admin session token and checks expiry.
 */
export function verifyAdminSessionToken(token: string | null | undefined): boolean {
  if (!token || typeof token !== 'string') return false;

  const parts = token.split(':');
  if (parts.length !== 3) return false;

  const [timestampStr, entropy, signature] = parts;
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) return false;

  // Check token age (12 hours)
  const now = Date.now();
  if (now - timestamp > SESSION_MAX_AGE_SECONDS * 1000 || timestamp > now + 60000) {
    return false;
  }

  const payload = `${timestampStr}:${entropy}`;
  const expectedSignature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('hex');

  return safeCompare(signature, expectedSignature);
}

/**
 * Validates admin authorization from a Request.
 * Checks both the HTTP-only cookie and the Authorization Bearer header.
 */
export function isRequestAuthorizedAsAdmin(req: Request): boolean {
  // 1. Check Authorization header
  const authHeader = req.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (verifyAdminSessionToken(token)) {
      return true;
    }
  }

  // 2. Check Cookie header
  const cookieHeader = req.headers.get('cookie') || '';
  const cookies = cookieHeader.split(';').map(c => c.trim());
  const sessionCookie = cookies.find(c => c.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (sessionCookie) {
    const token = decodeURIComponent(sessionCookie.split('=')[1] || '');
    if (verifyAdminSessionToken(token)) {
      return true;
    }
  }

  return false;
}

export { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS };
