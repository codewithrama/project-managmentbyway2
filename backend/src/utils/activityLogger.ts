import prisma from '../config/db';

export const logActivity = async (params: {
  userId: string;
  action: string;
  details?: string;
  projectId?: string;
  taskId?: string;
}) => {
  try {
    return await prisma.activityLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        details: params.details || null,
        projectId: params.projectId || null,
        taskId: params.taskId || null,
      },
    });
  } catch (err) {
    console.error('Failed to record activity log:', err);
  }
};
