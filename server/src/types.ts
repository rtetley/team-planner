export interface TeamMember {
  id: string;
  name: string;
  position: string;
  skills: string[];
}

export interface Project {
  id: string;
  name: string;
  description: string;
  techStack: string[];
  startDate: string;
  endDate: string;
  requiredSkills?: string[];
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'done';
  assignedTo?: string;
  projectId?: string;
}

export type MaturityLevel = 'M1' | 'M2' | 'M3' | 'M4';

export interface MatrixCell {
  teamMemberId: string;
  taskId: string;
  maturityLevel: MaturityLevel;
}

export interface SkillCell {
  teamMemberId: string;
  skillId: string;
  maturityLevel: MaturityLevel;
}

export type Quarter = 'T1' | 'T2' | 'T3' | 'T4';

export interface Objective {
  id: string;
  title: string;
  description: string;
  kpi: string;
  kpiProgress: number;
  quarters: Quarter[];
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export type UserRole = 'manager' | 'user';

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  /** Links a 'user' account to a TeamMember */
  teamMemberId?: string;
}

/** Shape returned to the client (no password hash) */
export interface PublicUser {
  id: string;
  username: string;
  role: UserRole;
  teamMemberId?: string;
}
