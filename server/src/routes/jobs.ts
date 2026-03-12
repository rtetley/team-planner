import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { db, KEYS } from '../db.js';
import type { JobSheet } from '../types.js';

export const jobsRoute = new Hono();

jobsRoute.get('/', async (c) => {
  const all = await db.hgetall(KEYS.jobs);
  return c.json(Object.values(all as Record<string, string>).map((v) => JSON.parse(v) as JobSheet));
});

jobsRoute.post('/', async (c) => {
  const body = await c.req.json<Omit<JobSheet, 'id'>>();
  const job: JobSheet = { id: randomUUID(), ...body };
  await db.hset(KEYS.jobs, job.id, JSON.stringify(job));
  return c.json(job, 201);
});

jobsRoute.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<Omit<JobSheet, 'id'>>();
  const job: JobSheet = { ...body, id };
  await db.hset(KEYS.jobs, id, JSON.stringify(job));
  return c.json(job);
});

jobsRoute.delete('/:id', async (c) => {
  await db.hdel(KEYS.jobs, c.req.param('id'));
  return c.body(null, 204);
});
