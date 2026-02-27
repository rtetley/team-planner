import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { db, KEYS } from '../db.js';
import type { TeamMember } from '../types.js';

export const teamMembersRoute = new Hono();

teamMembersRoute.get('/', async (c) => {
  const all = await db.hgetall(KEYS.members);
  return c.json(Object.values(all).map((v) => JSON.parse(v) as TeamMember));
});

teamMembersRoute.post('/', async (c) => {
  const body = await c.req.json<Omit<TeamMember, 'id'>>();
  const member: TeamMember = { id: randomUUID(), ...body };
  await db.hset(KEYS.members, member.id, JSON.stringify(member));
  return c.json(member, 201);
});

teamMembersRoute.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<Omit<TeamMember, 'id'>>();
  const member: TeamMember = { ...body, id };
  await db.hset(KEYS.members, id, JSON.stringify(member));
  return c.json(member);
});

teamMembersRoute.delete('/:id', async (c) => {
  await db.hdel(KEYS.members, c.req.param('id'));
  return c.body(null, 204);
});
