import { Hono } from 'hono';
import { db, KEYS } from '../db.js';
import type { SkillCell, MaturityLevel } from '../types.js';

export const skillMatrixRoute = new Hono();

skillMatrixRoute.get('/', async (c) => {
  const all = await db.hgetall(KEYS.skillMatrix);
  const cells: SkillCell[] = Object.entries(all).map(([key, level]) => {
    const [teamMemberId, ...rest] = key.split(':');
    return { teamMemberId, skillId: rest.join(':'), maturityLevel: level as MaturityLevel };
  });
  return c.json(cells);
});

skillMatrixRoute.put('/:teamMemberId/:skillId', async (c) => {
  const { teamMemberId, skillId } = c.req.param();
  const { maturityLevel } = await c.req.json<{ maturityLevel: MaturityLevel }>();
  await db.hset(KEYS.skillMatrix, `${teamMemberId}:${skillId}`, maturityLevel);
  return c.json({ teamMemberId, skillId, maturityLevel });
});

skillMatrixRoute.delete('/:teamMemberId/:skillId', async (c) => {
  const { teamMemberId, skillId } = c.req.param();
  await db.hdel(KEYS.skillMatrix, `${teamMemberId}:${skillId}`);
  return c.body(null, 204);
});
