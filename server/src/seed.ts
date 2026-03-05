import { db, KEYS } from './db.js';
import type { TeamMember, Project, Task, MatrixCell, Objective } from './types.js';
import type { User } from './types.js';
import { hashPassword } from './routes/auth.js';

// ── Seed data (mirrors mockData.ts) ─────────────────────────────────────────

const members: TeamMember[] = [
  { id: '1', name: 'Alice Dupont',    position: 'Senior Developer',   skills: ['React', 'TypeScript', 'Node.js'] },
  { id: '2', name: 'Bob Martin',      position: 'Full Stack Developer', skills: ['React', 'Python', 'PostgreSQL'] },
  { id: '3', name: 'Claire Bernard',  position: 'UX/UI Designer',      skills: ['Figma', 'CSS', 'Design Systems'] },
  { id: '4', name: 'David Leroy',     position: 'DevOps Engineer',     skills: ['Docker', 'Kubernetes', 'AWS'] },
];

const projects: Project[] = [
  { id: '1', name: 'TeamTree',             description: 'Internal team planning and skill management tool.', techStack: ['React', 'TypeScript', 'MUI', 'DSFR'], startDate: '2026-01-15', endDate: '2026-04-30' },
  { id: '2', name: 'E-Commerce Platform',  description: 'Full-stack e-commerce platform with product catalog and checkout.', techStack: ['React', 'Node.js', 'MongoDB'], startDate: '2026-02-01', endDate: '2026-06-30' },
  { id: '3', name: 'Documentation Portal', description: 'Developer documentation portal with MDX-powered content.', techStack: ['Next.js', 'MDX', 'Tailwind'], startDate: '2026-03-01', endDate: '2026-05-15' },
];

const tasks: Task[] = [
  { id: '1', title: 'Design team dashboard',       description: 'Create wireframes and mockups for the team dashboard',   status: 'done',        assignedTo: '3', projectId: '1' },
  { id: '2', title: 'Implement authentication',     description: 'Set up user authentication system',                       status: 'in-progress', assignedTo: '1', projectId: '1' },
  { id: '3', title: 'Set up CI/CD pipeline',        description: 'Configure automated testing and deployment',              status: 'todo',        assignedTo: '4', projectId: '1' },
  { id: '4', title: 'Product catalog API',          description: 'Develop RESTful API for product management',              status: 'in-progress', assignedTo: '2', projectId: '2' },
  { id: '5', title: 'Payment integration',          description: 'Integrate payment gateway',                               status: 'todo',                         projectId: '2' },
];

const matrixCells: MatrixCell[] = [
  { teamMemberId: '1', taskId: '1', maturityLevel: 'M3' },
  { teamMemberId: '1', taskId: '2', maturityLevel: 'M4' },
  { teamMemberId: '2', taskId: '1', maturityLevel: 'M2' },
  { teamMemberId: '2', taskId: '4', maturityLevel: 'M3' },
  { teamMemberId: '3', taskId: '1', maturityLevel: 'M4' },
  { teamMemberId: '4', taskId: '3', maturityLevel: 'M3' },
];

const objectives: Objective[] = [
  {
    id: '1', title: 'Deliver TeamTree MVP',
    description: 'Ship the first usable version of the TeamTree tool.\n\n- All 5 pages functional\n- DSFR compliant UI\n- Deployed to production',
    kpi: '100% of planned features shipped by end of Q1', kpiProgress: 85, quarters: ['T1'],
  },
  {
    id: '2', title: 'Improve CI/CD pipeline reliability',
    description: 'Reduce deployment failures and improve developer confidence.\n\n- Automated tests coverage > 80%\n- Deployment time < 5 minutes\n- Zero manual deployment steps',
    kpi: 'Deployment failure rate < 2%', kpiProgress: 40, quarters: ['T1', 'T2'],
  },
  {
    id: '3', title: 'Migrate e-commerce platform to new infrastructure',
    description: 'Move the existing e-commerce backend to Kubernetes.\n\n**Scope:**\n- Containerise all services\n- Set up auto-scaling\n- Migrate database with zero downtime',
    kpi: 'Zero downtime migration, p95 latency < 200ms post-migration', kpiProgress: 10, quarters: ['T2', 'T3'],
  },
  {
    id: '4', title: 'Launch documentation portal',
    description: 'Provide a centralised, searchable documentation hub for all internal teams.\n\n- Onboard 3 contributing teams\n- Cover all public APIs',
    kpi: 'Documentation coverage > 90% of public APIs', kpiProgress: 0, quarters: ['T3'],
  },
];

// ── Seed ─────────────────────────────────────────────────────────────────────

async function seed() {
  const existing = await db.hlen(KEYS.members);
  if (existing > 0) {
    console.log('[Seed] Data already present, skipping. Use FLUSH_BEFORE_SEED=1 to force re-seed.');
    if (process.env.FLUSH_BEFORE_SEED !== '1') { await db.quit(); return; }
    console.log('[Seed] Flushing existing data…');
    await db.del(KEYS.members, KEYS.projects, KEYS.tasks, KEYS.objectives, KEYS.matrix, KEYS.skillMatrix, KEYS.users);
  }

  // ── Hash passwords ─────────────────────────────────────────────────────────
  const [managerHash, aliceHash, bobHash, claireHash, davidHash] = await Promise.all([
    hashPassword('manager123'),
    hashPassword('alice123'),
    hashPassword('bob123'),
    hashPassword('claire123'),
    hashPassword('david123'),
  ]);

  const users: User[] = [
    { id: 'u0', username: 'manager',       passwordHash: managerHash, role: 'manager' },
    { id: 'u1', username: 'alice.dupont',  passwordHash: aliceHash,   role: 'user', teamMemberId: '1' },
    { id: 'u2', username: 'bob.martin',    passwordHash: bobHash,     role: 'user', teamMemberId: '2' },
    { id: 'u3', username: 'claire.bernard',passwordHash: claireHash,  role: 'user', teamMemberId: '3' },
    { id: 'u4', username: 'david.leroy',   passwordHash: davidHash,   role: 'user', teamMemberId: '4' },
  ];

  const pipeline = db.pipeline();
  members.forEach(m  => pipeline.hset(KEYS.members,    m.id,  JSON.stringify(m)));
  projects.forEach(p => pipeline.hset(KEYS.projects,   p.id,  JSON.stringify(p)));
  tasks.forEach(t    => pipeline.hset(KEYS.tasks,      t.id,  JSON.stringify(t)));
  objectives.forEach(o => pipeline.hset(KEYS.objectives, o.id, JSON.stringify(o)));
  matrixCells.forEach(c => pipeline.hset(KEYS.matrix, `${c.teamMemberId}:${c.taskId}`, c.maturityLevel));
  users.forEach(u => pipeline.hset(KEYS.users, u.id, JSON.stringify(u)));
  await pipeline.exec();

  console.log(`[Seed] Done — ${members.length} members, ${projects.length} projects, ${tasks.length} tasks, ${objectives.length} objectives, ${matrixCells.length} matrix cells, ${users.length} users.`);
  console.log('[Seed] Demo credentials:');
  console.log('  manager / manager123  (role: manager)');
  console.log('  alice.dupont / alice123  (role: user → Alice Dupont)');
  console.log('  bob.martin / bob123  (role: user → Bob Martin)');
  console.log('  claire.bernard / claire123  (role: user → Claire Bernard)');
  console.log('  david.leroy / david123  (role: user → David Leroy)');
  await db.quit();
}

seed().catch((err) => { console.error(err); process.exit(1); });
