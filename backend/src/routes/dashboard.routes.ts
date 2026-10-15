import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../config/db';
import { authenticate } from '../middleware/auth';

const router = Router();

// GET /api/dashboard/summary - Retrieve calculated metrics
router.get('/summary', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;

    // Project query scope
    const projectWhere: any = { isArchived: false };
    const taskWhere: any = {};

    if (user.role === 'TEAM_MEMBER') {
      projectWhere.OR = [
        { members: { some: { userId: user.id } } },
        { managerId: user.id },
      ];
      taskWhere.project = {
        OR: [
          { members: { some: { userId: user.id } } },
          { managerId: user.id },
        ],
      };
    } else if (user.role === 'PROJECT_MANAGER') {
      projectWhere.OR = [
        { managerId: user.id },
        { members: { some: { userId: user.id } } },
      ];
      taskWhere.project = {
        OR: [
          { managerId: user.id },
          { members: { some: { userId: user.id } } },
        ],
      };
    }

    const now = new Date();

    const [
      totalProjects,
      activeProjects,
      completedProjects,
      planningProjects,
      onHoldProjects,
      totalTasks,
      todoTasks,
      inProgressTasks,
      inReviewTasks,
      doneTasks,
      overdueTasks,
      myAssignedTasks,
      recentActivity,
    ] = await Promise.all([
      prisma.project.count({ where: projectWhere }),
      prisma.project.count({ where: { ...projectWhere, status: 'ACTIVE' } }),
      prisma.project.count({ where: { ...projectWhere, status: 'COMPLETED' } }),
      prisma.project.count({ where: { ...projectWhere, status: 'PLANNING' } }),
      prisma.project.count({ where: { ...projectWhere, status: 'ON_HOLD' } }),

      prisma.task.count({ where: taskWhere }),
      prisma.task.count({ where: { ...taskWhere, status: 'TODO' } }),
      prisma.task.count({ where: { ...taskWhere, status: 'IN_PROGRESS' } }),
      prisma.task.count({ where: { ...taskWhere, status: 'IN_REVIEW' } }),
      prisma.task.count({ where: { ...taskWhere, status: 'DONE' } }),

      prisma.task.count({
        where: {
          ...taskWhere,
          status: { not: 'DONE' },
          dueDate: { lt: now },
        },
      }),

      prisma.task.count({
        where: {
          assigneeId: user.id,
          status: { not: 'DONE' },
        },
      }),

      prisma.activityLog.findMany({
        where: user.role === 'ADMIN' ? {} : {
          OR: [
            { project: { members: { some: { userId: user.id } } } },
            { project: { managerId: user.id } },
            { userId: user.id },
          ],
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          project: { select: { id: true, name: true } },
          task: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const overallCompletionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

    res.json({
      success: true,
      data: {
        projects: {
          total: totalProjects,
          active: activeProjects,
          completed: completedProjects,
          planning: planningProjects,
          onHold: onHoldProjects,
        },
        tasks: {
          total: totalTasks,
          byStatus: {
            TODO: todoTasks,
            IN_PROGRESS: inProgressTasks,
            IN_REVIEW: inReviewTasks,
            DONE: doneTasks,
          },
          overdue: overdueTasks,
          myAssigned: myAssignedTasks,
          completionRate: overallCompletionRate,
        },
        recentActivity,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
