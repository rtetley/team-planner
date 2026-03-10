import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { db, KEYS } from '../db.js';
import type { Objective } from '../types.js';

export const objectivesRoute = new Hono();

objectivesRoute.get('/', async (c) => {
  const all = await db.hgetall(KEYS.objectives);
  return c.json(Object.values(all as Record<string, string>).map((v) => JSON.parse(v) as Objective));
});

objectivesRoute.post('/', async (c) => {
  const body = await c.req.json<Omit<Objective, 'id'>>();
  const objective: Objective = { id: randomUUID(), ...body };
  await db.hset(KEYS.objectives, objective.id, JSON.stringify(objective));
  return c.json(objective, 201);
});

objectivesRoute.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<Omit<Objective, 'id'>>();
  const objective: Objective = { ...body, id };
  await db.hset(KEYS.objectives, id, JSON.stringify(objective));
  return c.json(objective);
});

objectivesRoute.delete('/:id', async (c) => {
  await db.hdel(KEYS.objectives, c.req.param('id'));
  return c.body(null, 204);
});
