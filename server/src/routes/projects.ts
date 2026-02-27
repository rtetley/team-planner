import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { db, KEYS } from '../db.js';
import type { Project } from '../types.js';

export const projectsRoute = new Hono();

projectsRoute.get('/', async (c) => {
  const all = await db.hgetall(KEYS.projects);
  return c.json(Object.values(all).map((v) => JSON.parse(v) as Project));
});

projectsRoute.post('/', async (c) => {
  const body = await c.req.json<Omit<Project, 'id'>>();
  const project: Project = { id: randomUUID(), ...body };
  await db.hset(KEYS.projects, project.id, JSON.stringify(project));
  return c.json(project, 201);
});

projectsRoute.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<Omit<Project, 'id'>>();
  const project: Project = { ...body, id };
  await db.hset(KEYS.projects, id, JSON.stringify(project));
  return c.json(project);
});

projectsRoute.delete('/:id', async (c) => {
  await db.hdel(KEYS.projects, c.req.param('id'));
  return c.body(null, 204);
});
