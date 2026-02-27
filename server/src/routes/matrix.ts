import { Hono } from 'hono';
import { db, KEYS } from '../db.js';
import type { MatrixCell, MaturityLevel } from '../types.js';

export const matrixRoute = new Hono();

matrixRoute.get('/', async (c) => {
  const all = await db.hgetall(KEYS.matrix);
  const cells: MatrixCell[] = Object.entries(all).map(([key, level]) => {
    const [teamMemberId, taskId] = key.split(':');
    return { teamMemberId, taskId, maturityLevel: level as MaturityLevel };
  });
  return c.json(cells);
});

matrixRoute.put('/:teamMemberId/:taskId', async (c) => {
  const { teamMemberId, taskId } = c.req.param();
  const { maturityLevel } = await c.req.json<{ maturityLevel: MaturityLevel }>();
  await db.hset(KEYS.matrix, `${teamMemberId}:${taskId}`, maturityLevel);
  return c.json({ teamMemberId, taskId, maturityLevel });
});

matrixRoute.delete('/:teamMemberId/:taskId', async (c) => {
  const { teamMemberId, taskId } = c.req.param();
  await db.hdel(KEYS.matrix, `${teamMemberId}:${taskId}`);
  return c.body(null, 204);
});
