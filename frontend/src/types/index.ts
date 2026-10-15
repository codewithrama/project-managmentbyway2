export type Role = 'ADMIN' | 'PROJECT_MANAGER' | 'TEAM_MEMBER';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt?: string;
}

export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED';

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  user: User;
  joinedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  startDate: string | null;
  deadline: string | null;
  isArchived: boolean;
  managerId: string;
  manager: User;
  members: ProjectMember[];
  tasks?: Task[];
  totalTasks?: number;
  completedTasks?: number;
  progress?: number;
  activityLogs?: ActivityLog[];
  _count?: {
    tasks: number;
  };
  createdAt: string;
  updatedAt: string;
}

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';

export interface TaskComment {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  taskId: string;
  authorId: string;
  author: User;
}

export interface ActivityLog {
  id: string;
  action: string;
  details: string | null;
  createdAt: string;
  userId: string;
  user: {
    id: string;
    name: string;
    email?: string;
  };
  projectId?: string | null;
  project?: {
    id: string;
    name: string;
  } | null;
  taskId?: string | null;
  task?: {
    id: string;
    title: string;
  } | null;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  projectId: string;
  project?: {
    id: string;
    name: string;
  };
  assigneeId: string | null;
  assignee: User | null;
  creatorId: string;
  creator?: User;
  comments?: TaskComment[];
  activityLogs?: ActivityLog[];
  _count?: {
    comments: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface DashboardSummary {
  projects: {
    total: number;
    active: number;
    completed: number;
    planning: number;
    onHold: number;
  };
  tasks: {
    total: number;
    byStatus: {
      TODO: number;
      IN_PROGRESS: number;
      IN_REVIEW: number;
      DONE: number;
    };
    overdue: number;
    myAssigned: number;
    completionRate: number;
  };
  recentActivity: ActivityLog[];
}
