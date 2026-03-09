import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { teamMembersRoute } from './routes/teamMembers.js';
import { projectsRoute } from './routes/projects.js';
import { tasksRoute } from './routes/tasks.js';
import { objectivesRoute } from './routes/objectives.js';
import { matrixRoute } from './routes/matrix.js';
import { skillMatrixRoute } from './routes/skillMatrix.js';
import { skillTreeRoute }   from './routes/skillTree.js';
import { authRoute } from './routes/auth.js';
import { requireAuth } from './middleware/auth.js';
import { skillPointsRoute } from './routes/skillPoints.js';
import { db } from './db.js';
import { runMigrations } from './migrations/runner.js';

const app = new Hono();

app.use('*', cors({ origin: '*' }));

// ── Public routes ─────────────────────────────────────────────────────────────
app.route('/api/auth', authRoute);
app.get('/api/health', (c) => c.json({ status: 'ok' }));

// ── Protected routes (require valid session) ──────────────────────────────────
app.use('/api/team-members/*', requireAuth);
app.use('/api/projects/*',     requireAuth);
app.use('/api/tasks/*',        requireAuth);
app.use('/api/objectives/*',   requireAuth);
app.use('/api/matrix/*',       requireAuth);
app.use('/api/skill-matrix/*', requireAuth);
app.use('/api/skill-tree/*',   requireAuth);
// Also protect the root collection paths (no trailing slash)
app.use('/api/team-members',   requireAuth);
app.use('/api/projects',       requireAuth);
app.use('/api/tasks',          requireAuth);
app.use('/api/objectives',     requireAuth);
app.use('/api/matrix',         requireAuth);
app.use('/api/skill-matrix',   requireAuth);
app.use('/api/skill-tree',     requireAuth);app.use('/api/skill-points/*', requireAuth);
app.use('/api/skill-points',   requireAuth);
app.route('/api/team-members', teamMembersRoute);
app.route('/api/projects',     projectsRoute);
app.route('/api/tasks',        tasksRoute);
app.route('/api/objectives',   objectivesRoute);
app.route('/api/matrix',       matrixRoute);
app.route('/api/skill-matrix', skillMatrixRoute);
app.route('/api/skill-tree',   skillTreeRoute);
app.route('/api/skill-points', skillPointsRoute);

const PORT = Number(process.env.PORT ?? 3001);

// Run pending migrations before accepting traffic
await runMigrations(db);

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`[TeamTree Server] Listening on http://localhost:${PORT}`);
});

