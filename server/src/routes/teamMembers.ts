import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { db, KEYS } from '../db.js';
import type { TeamMember, User } from '../types.js';

export const teamMembersRoute = new Hono();

teamMembersRoute.get('/', async (c) => {
  const all = await db.hgetall(KEYS.members);
  return c.json(Object.values(all).map((v) => JSON.parse(v) as TeamMember));
});

/** Returns members not yet assigned to any manager, plus GitLab users who have
 *  logged in but have no TeamMember record yet.
 *  Synthesized GitLab entries include `_fromUserId` so the client knows to call
 *  the /from-user endpoint instead of the regular update. */
teamMembersRoute.get('/available', async (c) => {
  const [allMembers, allUsers] = await Promise.all([
    db.hgetall(KEYS.members),
    db.hgetall(KEYS.users),
  ]);

  const unassigned = Object.values(allMembers)
    .map((v) => JSON.parse(v) as TeamMember)
    .filter((m) => !m.managerId);

  // GitLab-authenticated users who have never been linked to a TeamMember
  const unlinked = Object.values(allUsers)
    .map((v) => JSON.parse(v) as User)
    .filter((u) => u.role === 'user' && !u.teamMemberId && u.gitlabId !== undefined)
    .map((u) => ({
      id:           u.id,
      name:         u.displayName ?? u.username,
      position:     '',
      skills:       [] as string[],
      _fromUserId:  u.id,
    }));

  return c.json([...unassigned, ...unlinked]);
});

/** Creates a TeamMember from a GitLab-authenticated User, links them together
 *  and stamps the manager who added them. */
teamMembersRoute.post('/from-user', async (c) => {
  const { userId, managerId } = await c.req.json<{ userId: string; managerId: string }>();

  const userJson = await db.hget(KEYS.users, userId);
  if (!userJson) return c.json({ error: 'User not found' }, 404);
  const user: User = JSON.parse(userJson);

  if (user.teamMemberId) return c.json({ error: 'User already linked to a team member' }, 400);

  const member: TeamMember = {
    id:        randomUUID(),
    name:      user.displayName ?? user.username,
    position:  '',
    skills:    [],
    managerId,
  };

  user.teamMemberId = member.id;

  const pipeline = db.pipeline();
  pipeline.hset(KEYS.members, member.id, JSON.stringify(member));
  pipeline.hset(KEYS.users,   userId,    JSON.stringify(user));
  await pipeline.exec();

  return c.json(member, 201);
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
