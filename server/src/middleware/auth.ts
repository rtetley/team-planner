import type { Context, Next } from 'hono';
import { db, KEYS } from '../db.js';
import type { User, UserRole, PublicUser } from '../types.js';

// Augment Hono context variables
declare module 'hono' {
  interface ContextVariableMap {
    user: PublicUser;
  }
}

/** Validates the Bearer token and attaches the public user to context. */
export async function requireAuth(c: Context, next: Next) {
  const auth = c.req.header('Authorization') ?? '';
  const token = auth.replace('Bearer ', '').trim();

  if (!token) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const userId = await db.get(`${KEYS.sessions}:${token}`);
  if (!userId) {
    return c.json({ error: 'Session expired or invalid' }, 401);
  }

  const userJson = await db.hget(KEYS.users, userId);
  if (!userJson) {
    return c.json({ error: 'User not found' }, 401);
  }

  const user: User = JSON.parse(userJson);
  c.set('user', { id: user.id, username: user.username, role: user.role, teamMemberId: user.teamMemberId });

  await next();
}

/** Wraps requireAuth and additionally enforces a role. */
export function requireRole(...roles: UserRole[]) {
  return async (c: Context, next: Next) => {
    // First validate auth — if it fails, requireAuth will return a 401
    let authPassed = false;
    await requireAuth(c, async () => { authPassed = true; });
    if (!authPassed) return;

    const user = c.get('user');
    if (!roles.includes(user.role)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    await next();
  };
}
