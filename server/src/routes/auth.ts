import { Hono } from 'hono';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { db, KEYS } from '../db.js';
import type { User, PublicUser } from '../types.js';

const scryptAsync = promisify(scrypt);

// Session TTL: 24 hours
const SESSION_TTL = 60 * 60 * 24;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Hash a plain-text password: returns "salt:hash" */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}

/** Compare a plain-text password against a stored "salt:hash" */
async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hashHex] = stored.split(':');
  if (!salt || !hashHex) return false;
  const storedBuf = Buffer.from(hashHex, 'hex');
  const derivedBuf = (await scryptAsync(password, salt, 64)) as Buffer;
  if (storedBuf.length !== derivedBuf.length) return false;
  return timingSafeEqual(storedBuf, derivedBuf);
}

/** Generate a secure random session token */
function generateToken(): string {
  return randomBytes(32).toString('hex');
}

function toPublicUser(user: User): PublicUser {
  return { id: user.id, username: user.username, role: user.role, teamMemberId: user.teamMemberId };
}

// ── Route ────────────────────────────────────────────────────────────────────

export const authRoute = new Hono();

/** POST /api/auth/login */
authRoute.post('/login', async (c) => {
  const body = await c.req.json() as { username?: string; password?: string };

  if (!body.username || !body.password) {
    return c.json({ error: 'username and password are required' }, 400);
  }

  const username = body.username;
  const password = body.password;

  // Look up user by username (scan all users)
  const all = await db.hgetall(KEYS.users);
  const userJson = Object.values(all as Record<string, string>).find((v) => {
    try { return (JSON.parse(v) as User).username === username; }
    catch { return false; }
  }) as string | undefined;

  if (!userJson) return c.json({ error: 'Invalid credentials' }, 401);

  const user: User = JSON.parse(userJson as string);

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return c.json({ error: 'Invalid credentials' }, 401);

  // Create session in Redis with TTL
  const token = generateToken();
  await db.setex(`${KEYS.sessions}:${token}`, SESSION_TTL, user.id);

  return c.json({ token, user: toPublicUser(user) });
});

/** POST /api/auth/logout */
authRoute.post('/logout', async (c) => {
  const auth = c.req.header('Authorization') ?? '';
  const token = auth.replace('Bearer ', '').trim();
  if (token) await db.del(`${KEYS.sessions}:${token}`);
  return c.json({ ok: true });
});

/** GET /api/auth/me */
authRoute.get('/me', async (c) => {
  const auth = c.req.header('Authorization') ?? '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) return c.json({ error: 'Not authenticated' }, 401);

  const userId = await db.get(`${KEYS.sessions}:${token}`);
  if (!userId) return c.json({ error: 'Session expired or invalid' }, 401);

  const userJson = await db.hget(KEYS.users, userId);
  if (!userJson) return c.json({ error: 'User not found' }, 401);

  const user: User = JSON.parse(userJson);
  return c.json({ user: toPublicUser(user) });
});
