import { Hono } from 'hono';
import { db, KEYS } from '../db.js';

export const skillTreeRoute = new Hono();

/** GET /api/skill-tree — returns the full SkillTreeDoc (treeId, version, root) */
skillTreeRoute.get('/', async (c) => {
  const raw = await db.get(KEYS.skillTree);
  if (!raw) return c.json({ error: 'Skill tree not found. Run update-skill-tree first.' }, 404);
  return c.json(JSON.parse(raw));
});
