import type {
  TeamMember,
  AvailableMember,
  Project,
  Task,
  MaturityLevel,
  MatrixCell,
  SkillCell,
  Objective,
  SkillTreeDoc,
  AuthUser,
  UserRole,
} from '../types';

// Derive the API root from Vite's base URL so it works both locally and behind
// a reverse-proxy sub-path (e.g. /teamtree/api when base = '/teamtree/').
const BASE = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api`;

function getToken(): string | null {
  return localStorage.getItem('teamtree_token');
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { headers, ...init });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

// ── Team Members ──────────────────────────────────────────────────────────────

export const teamMembersApi = {
  getAll: () => req<TeamMember[]>('/team-members'),
  getAvailable: () => req<AvailableMember[]>('/team-members/available'),
  createFromUser: (userId: string, managerId: string) =>
    req<TeamMember>('/team-members/from-user', {
      method: 'POST',
      body: JSON.stringify({ userId, managerId }),
    }),
  create: (data: Omit<TeamMember, 'id'>) =>
    req<TeamMember>('/team-members', { method: 'POST', body: JSON.stringify(data) }),
  update: (member: TeamMember) =>
    req<TeamMember>(`/team-members/${member.id}`, { method: 'PUT', body: JSON.stringify(member) }),
  remove: (id: string) =>
    req<void>(`/team-members/${id}`, { method: 'DELETE' }),
};

// ── Projects ──────────────────────────────────────────────────────────────────

export const projectsApi = {
  getAll: () => req<Project[]>('/projects'),
  create: (data: Omit<Project, 'id'>) =>
    req<Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),
  update: (project: Project) =>
    req<Project>(`/projects/${project.id}`, { method: 'PUT', body: JSON.stringify(project) }),
  remove: (id: string) =>
    req<void>(`/projects/${id}`, { method: 'DELETE' }),
};

// ── Tasks ─────────────────────────────────────────────────────────────────────

export const tasksApi = {
  getAll: () => req<Task[]>('/tasks'),
  create: (data: Omit<Task, 'id'>) =>
    req<Task>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  update: (task: Task) =>
    req<Task>(`/tasks/${task.id}`, { method: 'PUT', body: JSON.stringify(task) }),
  remove: (id: string) =>
    req<void>(`/tasks/${id}`, { method: 'DELETE' }),
};

// ── Objectives ────────────────────────────────────────────────────────────────

export const objectivesApi = {
  getAll: () => req<Objective[]>('/objectives'),
  create: (data: Omit<Objective, 'id'>) =>
    req<Objective>('/objectives', { method: 'POST', body: JSON.stringify(data) }),
  update: (objective: Objective) =>
    req<Objective>(`/objectives/${objective.id}`, { method: 'PUT', body: JSON.stringify(objective) }),
  remove: (id: string) =>
    req<void>(`/objectives/${id}`, { method: 'DELETE' }),
};

// ── Task Matrix ───────────────────────────────────────────────────────────────

export const matrixApi = {
  getAll: () => req<MatrixCell[]>('/matrix'),
  upsert: (teamMemberId: string, taskId: string, maturityLevel: MaturityLevel) =>
    req<MatrixCell>(`/matrix/${teamMemberId}/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify({ maturityLevel }),
    }),
  remove: (teamMemberId: string, taskId: string) =>
    req<void>(`/matrix/${teamMemberId}/${taskId}`, { method: 'DELETE' }),
};

// ── Skill Matrix ──────────────────────────────────────────────────────────────

export const skillMatrixApi = {
  getAll: () => req<SkillCell[]>('/skill-matrix'),
  upsert: (teamMemberId: string, skillId: string, maturityLevel: MaturityLevel) =>
    req<SkillCell>(`/skill-matrix/${encodeURIComponent(teamMemberId)}/${encodeURIComponent(skillId)}`, {
      method: 'PUT',
      body: JSON.stringify({ maturityLevel }),
    }),
  remove: (teamMemberId: string, skillId: string) =>
    req<void>(`/skill-matrix/${encodeURIComponent(teamMemberId)}/${encodeURIComponent(skillId)}`, {
      method: 'DELETE',
    }),
};

// ── Skill Tree ────────────────────────────────────────────────────────────────

export const skillTreeApi = {
  get: () => req<SkillTreeDoc>('/skill-tree'),
};

// ── Skill Points ─────────────────────────────────────────────────────────────

export const skillPointsApi = {
  getAll: () => req<Record<string, number>>('/skill-points'),
  update: (nodeId: string, points: number) =>
    req<Record<string, number>>(`/skill-points/${encodeURIComponent(nodeId)}`, {
      method: 'PUT',
      body: JSON.stringify({ points }),
    }),
};

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  login: (username: string, password: string) =>
    req<{ token: string; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () =>
    req<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  me: () =>
    req<{ user: AuthUser }>('/auth/me'),
};

// ── Users (manager only) ──────────────────────────────────────────────────────

export const usersApi = {
  getAll: () => req<AuthUser[]>('/users'),
  updateRole: (id: string, role: UserRole) =>
    req<AuthUser>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  remove: (id: string) =>
    req<void>(`/users/${id}`, { method: 'DELETE' }),
};
