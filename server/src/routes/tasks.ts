import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { db, KEYS } from '../db.js';
import type { Task } from '../types.js';

export const tasksRoute = new Hono();

tasksRoute.get('/', async (c) => {
  const all = await db.hgetall(KEYS.tasks);
  return c.json(Object.values(all).map((v) => JSON.parse(v) as Task));
});

tasksRoute.post('/', async (c) => {
  const body = await c.req.json<Omit<Task, 'id'>>();
  const task: Task = { id: randomUUID(), ...body };
  await db.hset(KEYS.tasks, task.id, JSON.stringify(task));
  return c.json(task, 201);
});

tasksRoute.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<Omit<Task, 'id'>>();
  const task: Task = { ...body, id };
  await db.hset(KEYS.tasks, id, JSON.stringify(task));
  return c.json(task);
});

tasksRoute.delete('/:id', async (c) => {
  await db.hdel(KEYS.tasks, c.req.param('id'));
  return c.body(null, 204);
});
