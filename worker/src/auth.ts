import {
  LOGIN_MAX_ATTEMPTS,
  LOGIN_WINDOW_MINUTES,
  SESSION_COOKIE,
} from './constants';
import { hashPassword, randomToken, sha256Hex, verifyPassword } from './crypto';
import { apiError, json } from './http';
import type { AdminUser, Env } from './types';

export function clientIp(request: Request): string {
  const header = request.headers.get('cf-connecting-ip');
  if (header) return header;
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return 'unknown';
}

function sessionTtlDays(env: Env): number {
  const parsed = Number.parseInt(env.SESSION_TTL_DAYS ?? '7', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 7;
}

/**
 * Builds the `Set-Cookie` value for the session cookie.
 *
 * The `Secure` flag is only added over HTTPS. Cloudflare always serves HTTPS,
 * but during local testing the portal is reached over plain HTTP on the LAN,
 * where a `Secure` cookie would be dropped by the browser and the sign-in
 * would silently fail.
 */
export function sessionCookie(token: string, env: Env, secure: boolean): string {
  const maxAge = sessionTtlDays(env) * 24 * 60 * 60;
  return [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    ...(secure ? ['Secure'] : []),
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ].join('; ');
}

export function clearedSessionCookie(secure: boolean): string {
  return [
    `${SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    ...(secure ? ['Secure'] : []),
    'SameSite=Lax',
    'Max-Age=0',
  ].join('; ');
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=') || null;
  }
  return null;
}

/**
 * Creates the very first administrator from the bootstrap secrets, so a fresh
 * deployment is usable without hand-writing SQL. Only runs while the admins
 * table is empty.
 */
export async function bootstrapAdmin(env: Env): Promise<void> {
  const username = env.ADMIN_BOOTSTRAP_USER?.trim();
  const password = env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!username || !password) return;

  const existing = await env.DB.prepare('SELECT COUNT(*) AS count FROM admins').first<{ count: number }>();
  if ((existing?.count ?? 0) > 0) return;

  await env.DB.prepare(
    'INSERT INTO admins (id, username, password_hash) VALUES (?, ?, ?)',
  )
    .bind(crypto.randomUUID(), username, await hashPassword(password))
    .run();
}

export interface LoginResult {
  ok: boolean;
  response?: Response;
  token?: string;
  admin?: AdminUser;
}

/**
 * Verifies credentials, enforcing a per-IP attempt limit inside a rolling
 * window. Failed attempts are counted, successful ones clear the counter.
 */
export async function login(env: Env, request: Request, username: string, password: string): Promise<LoginResult> {
  await bootstrapAdmin(env);

  const ip = clientIp(request);
  if (await isRateLimited(env, ip)) {
    return {
      ok: false,
      response: apiError(
        429,
        'rate_limited',
        'Too many failed sign-in attempts. Try again in a few minutes.',
        { 'retry-after': String(LOGIN_WINDOW_MINUTES * 60) },
      ),
    };
  }

  const row = await env.DB.prepare(
    'SELECT id, username, password_hash FROM admins WHERE username = ?',
  )
    .bind(username)
    .first<{ id: string; username: string; password_hash: string }>();

  const passwordOk = row
    ? await verifyPassword(password, row.password_hash)
    : // Keep the timing similar for unknown users.
      await verifyPassword(password, 'pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=');

  if (!row || !passwordOk) {
    await recordFailedAttempt(env, ip);
    return {
      ok: false,
      response: apiError(401, 'invalid_credentials', 'Incorrect username or password.'),
    };
  }

  await clearFailedAttempts(env, ip);

  const token = randomToken(32);
  const ttlDays = sessionTtlDays(env);
  await env.DB.prepare(
    "INSERT INTO sessions (token_hash, admin_id, expires_at) VALUES (?, ?, datetime('now', '+' || ? || ' days'))",
  )
    .bind(await sha256Hex(token), row.id, String(ttlDays))
    .run();

  return {
    ok: true,
    token,
    admin: { id: row.id, username: row.username },
  };
}

export async function logout(env: Env, request: Request): Promise<void> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return;
  await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run();
}

/** Returns the signed-in administrator, or null. Expired sessions are removed. */
export async function currentAdmin(env: Env, request: Request): Promise<AdminUser | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;

  const tokenHash = await sha256Hex(token);
  const row = await env.DB.prepare(
    `SELECT s.admin_id AS id, a.username AS username, s.expires_at AS expires_at
       FROM sessions s
       JOIN admins a ON a.id = s.admin_id
      WHERE s.token_hash = ?`,
  )
    .bind(tokenHash)
    .first<{ id: string; username: string; expires_at: string }>();

  if (!row) return null;

  if (row.expires_at <= new Date().toISOString().slice(0, 19).replace('T', ' ')) {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
    return null;
  }

  return { id: row.id, username: row.username };
}

/** Guards an admin route. Returns a 401 response when the caller is anonymous. */
export async function requireAdmin(
  env: Env,
  request: Request,
): Promise<{ admin: AdminUser } | { response: Response }> {
  const admin = await currentAdmin(env, request);
  if (!admin) {
    return {
      response: apiError(401, 'unauthorized', 'Sign in to use the admin dashboard.'),
    };
  }
  return { admin };
}

export function loginResponse(
  token: string,
  admin: AdminUser,
  env: Env,
  secure: boolean,
): Response {
  return json(
    { admin: { username: admin.username } },
    200,
    { 'set-cookie': sessionCookie(token, env, secure) },
  );
}

async function isRateLimited(env: Env, ip: string): Promise<boolean> {
  const row = await env.DB.prepare(
    'SELECT attempts, window_at FROM login_attempts WHERE ip = ?',
  )
    .bind(ip)
    .first<{ attempts: number; window_at: string }>();

  if (!row) return false;

  const windowEnd = new Date(`${row.window_at.replace(' ', 'T')}Z`).getTime();
  if (Number.isFinite(windowEnd) && windowEnd < Date.now()) {
    await clearFailedAttempts(env, ip);
    return false;
  }

  return row.attempts >= LOGIN_MAX_ATTEMPTS;
}

async function recordFailedAttempt(env: Env, ip: string): Promise<void> {
  const windowAt = new Date(Date.now() + LOGIN_WINDOW_MINUTES * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');

  await env.DB.prepare(
    `INSERT INTO login_attempts (ip, attempts, window_at) VALUES (?, 1, ?)
       ON CONFLICT(ip) DO UPDATE SET attempts = attempts + 1, window_at = excluded.window_at`,
  )
    .bind(ip, windowAt)
    .run();
}

async function clearFailedAttempts(env: Env, ip: string): Promise<void> {
  await env.DB.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(ip).run();
}
