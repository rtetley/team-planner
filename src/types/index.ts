export interface TeamMember {
  id: string;
  name: string;
  position: string;
  skills: string[];
}

export interface Project {
  id: string;
  name: string;
  techStack: string[];
  startDate: string;
  endDate: string;
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
  maturityLevel: MaturityLevel | null;
}

export interface TeamMatrix {
  id: string;
  name: string;
  cells: MatrixCell[];
}

export type Quarter = 'T1' | 'T2' | 'T3' | 'T4';

export interface Objective {
  id: string;
  title: string;
  description: string;
  kpi: string;
  quarters: Quarter[];
}
