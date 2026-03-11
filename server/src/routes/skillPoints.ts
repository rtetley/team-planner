import { Hono } from 'hono';
import { db, KEYS } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const skillPointsRoute = new Hono();

skillPointsRoute.use('*', requireAuth);

const MAX_POINTS = 5;

function userKey(userId: string): string {
  return `${KEYS.skillPoints}:${userId}`;
}

async function getAll(userId: string): Promise<Record<string, number>> {
  const raw = await db.hgetall(userKey(userId));
  const points: Record<string, number> = {};
  for (const [nodeId, val] of Object.entries(raw as Record<string, string>)) {
    const n = Number(val);
    if (n > 0) points[nodeId] = n;
  }
  return points;
}

/** GET /api/skill-points — returns { [nodeId]: number } for the authenticated user */
skillPointsRoute.get('/', async (c) => {
  const user = c.get('user');
  return c.json(await getAll(user.id));
});

/** GET /api/skill-points/user/:userId — manager only, returns points for any user */
skillPointsRoute.get('/user/:userId', requireRole('manager'), async (c) => {
  const userId = c.req.param('userId');
  return c.json(await getAll(userId));
});

/** PUT /api/skill-points/:nodeId — body { points: number } clamps 0-MAX_POINTS */
skillPointsRoute.put('/:nodeId', async (c) => {
  const user = c.get('user');
  const nodeId = c.req.param('nodeId');
  const body = await c.req.json() as { points?: unknown };
  const points = Math.min(MAX_POINTS, Math.max(0, Number(body.points ?? 0)));

  const key = userKey(user.id);
  if (points === 0) {
    await db.hdel(key, nodeId);
  } else {
    await db.hset(key, nodeId, String(points));
  }

  return c.json(await getAll(user.id));
});
