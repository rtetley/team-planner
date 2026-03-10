import { Hono } from 'hono';
import { db, KEYS } from '../db.js';
import type { User, PublicUser, UserRole } from '../types.js';
import { requireRole } from '../middleware/auth.js';

export const usersRoute = new Hono();

// All routes in this file require manager role
usersRoute.use('*', requireRole('manager'));

function toPublicUser(user: User): PublicUser {
  return {
    id:           user.id,
    username:     user.username,
    role:         user.role,
    teamMemberId: user.teamMemberId,
    displayName:  user.displayName,
    avatarUrl:    user.avatarUrl,
  };
}

/** GET /api/users — list all registered accounts */
usersRoute.get('/', async (c) => {
  const all = await db.hgetall(KEYS.users);
  const users: PublicUser[] = Object.values(all as Record<string, string>).map((v) =>
    toPublicUser(JSON.parse(v) as User),
  );
  // Stable order: managers first, then alphabetically by username
  users.sort((a, b) => {
    if (a.role !== b.role) return a.role === 'manager' ? -1 : 1;
    return a.username.localeCompare(b.username);
  });
  return c.json(users);
});

/** PATCH /api/users/:id — update role */
usersRoute.patch('/:id', async (c) => {
  const targetId = c.req.param('id');
  const requestingUser = c.get('user');
  const body = await c.req.json() as { role?: UserRole };

  if (!body.role || !['manager', 'user'].includes(body.role)) {
    return c.json({ error: 'role must be "manager" or "user"' }, 400);
  }

  // Prevent a manager from demoting themselves (would lock them out)
  if (targetId === requestingUser.id && body.role !== 'manager') {
    return c.json({ error: 'You cannot change your own role' }, 400);
  }

  const userJson = await db.hget(KEYS.users, targetId);
  if (!userJson) return c.json({ error: 'User not found' }, 404);

  const user: User = JSON.parse(userJson);
  user.role = body.role;
  await db.hset(KEYS.users, targetId, JSON.stringify(user));

  return c.json(toPublicUser(user));
});

/** DELETE /api/users/:id — remove an account */
usersRoute.delete('/:id', async (c) => {
  const targetId = c.req.param('id');
  const requestingUser = c.get('user');

  if (targetId === requestingUser.id) {
    return c.json({ error: 'You cannot delete your own account' }, 400);
  }

  const exists = await db.hexists(KEYS.users, targetId);
  if (!exists) return c.json({ error: 'User not found' }, 404);

  await db.hdel(KEYS.users, targetId);
  return c.body(null, 204);
});
