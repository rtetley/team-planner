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

const app = new Hono();

app.use('*', cors({ origin: '*' }));

app.route('/api/team-members', teamMembersRoute);
app.route('/api/projects',     projectsRoute);
app.route('/api/tasks',        tasksRoute);
app.route('/api/objectives',   objectivesRoute);
app.route('/api/matrix',       matrixRoute);
app.route('/api/skill-matrix', skillMatrixRoute);
app.route('/api/skill-tree',   skillTreeRoute);

app.get('/api/health', (c) => c.json({ status: 'ok' }));

const PORT = Number(process.env.PORT ?? 3001);
serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`[TeamTree Server] Listening on http://localhost:${PORT}`);
});
