import { TeamMember, Project, Task, TeamMatrix } from '../types';

export const mockTeamMembers: TeamMember[] = [
  {
    id: '1',
    name: 'Alice Dupont',
    position: 'Senior Developer',
    skills: ['React', 'TypeScript', 'Node.js'],
  },
  {
    id: '2',
    name: 'Bob Martin',
    position: 'Full Stack Developer',
    skills: ['React', 'Python', 'PostgreSQL'],
  },
  {
    id: '3',
    name: 'Claire Bernard',
    position: 'UX/UI Designer',
    skills: ['Figma', 'CSS', 'Design Systems'],
  },
  {
    id: '4',
    name: 'David Leroy',
    position: 'DevOps Engineer',
    skills: ['Docker', 'Kubernetes', 'AWS'],
  },
];

export const mockProjects: Project[] = [
  {
    id: '1',
    name: 'Team Planner',
    techStack: ['React', 'TypeScript', 'MUI', 'DSFR'],
    startDate: '2026-01-15',
    endDate: '2026-04-30',
  },
  {
    id: '2',
    name: 'E-Commerce Platform',
    techStack: ['React', 'Node.js', 'MongoDB'],
    startDate: '2026-02-01',
    endDate: '2026-06-30',
  },
  {
    id: '3',
    name: 'Documentation Portal',
    techStack: ['Next.js', 'MDX', 'Tailwind'],
    startDate: '2026-03-01',
    endDate: '2026-05-15',
  },
];

export const mockTasks: Task[] = [
  {
    id: '1',
    title: 'Design team dashboard',
    description: 'Create wireframes and mockups for the team dashboard',
    status: 'done',
    assignedTo: '3',
    projectId: '1',
  },
  {
    id: '2',
    title: 'Implement authentication',
    description: 'Set up user authentication system',
    status: 'in-progress',
    assignedTo: '1',
    projectId: '1',
  },
  {
    id: '3',
    title: 'Set up CI/CD pipeline',
    description: 'Configure automated testing and deployment',
    status: 'todo',
    assignedTo: '4',
    projectId: '1',
  },
  {
    id: '4',
    title: 'Product catalog API',
    description: 'Develop RESTful API for product management',
    status: 'in-progress',
    assignedTo: '2',
    projectId: '2',
  },
  {
    id: '5',
    title: 'Payment integration',
    description: 'Integrate payment gateway',
    status: 'todo',
    projectId: '2',
  },
];

export const mockTeamMatrix: TeamMatrix = {
  id: '1',
  name: 'Q1 2026 Team Assessment',
  cells: [
    { teamMemberId: '1', taskId: '1', maturityLevel: 'M3' },
    { teamMemberId: '1', taskId: '2', maturityLevel: 'M4' },
    { teamMemberId: '2', taskId: '1', maturityLevel: 'M2' },
    { teamMemberId: '2', taskId: '4', maturityLevel: 'M3' },
    { teamMemberId: '3', taskId: '1', maturityLevel: 'M4' },
    { teamMemberId: '4', taskId: '3', maturityLevel: 'M3' },
  ],
};
