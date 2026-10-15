import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/db';
import { authenticate, authorize } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { logActivity } from '../utils/activityLogger';

const router = Router();

const createProjectSchema = z.object({
  name: z.string().min(2, 'Project name is required'),
  description: z.string().optional(),
  status: z.enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED']).optional().default('ACTIVE'),
  startDate: z.string().datetime().optional().nullable(),
  deadline: z.string().datetime().optional().nullable(),
  memberIds: z.array(z.string()).optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED']).optional(),
  startDate: z.string().datetime().optional().nullable(),
  deadline: z.string().datetime().optional().nullable(),
  isArchived: z.boolean().optional(),
});

export const checkProjectAccess = async (projectId: string, user: { id: string; role: string }) => {
  if (user.role === 'ADMIN') return true;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      members: { select: { userId: true } },
    },
  });

  if (!project) return false;
  if (project.managerId === user.id) return true;

  return project.members.some((m) => m.userId === user.id);
};

// GET /api/projects
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { status, search, includeArchived } = req.query;

    const where: any = {};

    if (includeArchived !== 'true') {
      where.isArchived = false;
    }

    if (status && typeof status === 'string') {
      where.status = status;
    }

    if (search && typeof search === 'string') {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    if (user.role === 'TEAM_MEMBER') {
      where.OR = [
        { members: { some: { userId: user.id } } },
        { managerId: user.id },
      ];
    } else if (user.role === 'PROJECT_MANAGER') {
      where.OR = [
        { managerId: user.id },
        { members: { some: { userId: user.id } } },
      ];
    }

    const projects = await prisma.project.findMany({
      where,
      include: {
        manager: {
          select: { id: true, name: true, email: true },
        },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
        _count: {
          select: {
            tasks: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const enrichedProjects = await Promise.all(
      projects.map(async (project) => {
        const completedTasks = await prisma.task.count({
          where: { projectId: project.id, status: 'DONE' },
        });
        const totalTasks = project._count.tasks;
        const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        return {
          ...project,
          completedTasks,
          progress,
        };
      })
    );

    res.json({
      success: true,
      data: enrichedProjects,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/projects
router.post('/', authenticate, authorize(['ADMIN', 'PROJECT_MANAGER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = createProjectSchema.parse(req.body);

    const project = await prisma.project.create({
      data: {
        name: validated.name.trim(),
        description: validated.description?.trim(),
        status: validated.status,
        startDate: validated.startDate ? new Date(validated.startDate) : null,
        deadline: validated.deadline ? new Date(validated.deadline) : null,
        managerId: req.user!.id,
        members: validated.memberIds && validated.memberIds.length > 0
          ? {
              create: validated.memberIds.map((userId) => ({ userId })),
            }
          : undefined,
      },
      include: {
        manager: { select: { id: true, name: true, email: true } },
        members: {
          include: { user: { select: { id: true, name: true, email: true, role: true } } },
        },
      },
    });

    await logActivity({
      userId: req.user!.id,
      projectId: project.id,
      action: 'PROJECT_CREATED',
      details: `Project "${project.name}" was created`,
    });

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: project,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/projects/:id
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const hasAccess = await checkProjectAccess(id, req.user!);
    if (!hasAccess) {
      throw new AppError('You do not have permission to view this project', 403);
    }

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        manager: { select: { id: true, name: true, email: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
        tasks: {
          include: {
            assignee: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        activityLogs: {
          include: {
            user: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    const totalTasks = project.tasks.length;
    const completedTasks = project.tasks.filter((t) => t.status === 'DONE').length;
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    res.json({
      success: true,
      data: {
        ...project,
        totalTasks,
        completedTasks,
        progress,
      },
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/projects/:id
router.patch('/:id', authenticate, authorize(['ADMIN', 'PROJECT_MANAGER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const validated = updateProjectSchema.parse(req.body);

    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Project not found', 404);
    }

    if (req.user!.role !== 'ADMIN' && existing.managerId !== req.user!.id) {
      throw new AppError('Forbidden: Only the project manager or an admin can edit this project', 403);
    }

    const updated = await prisma.project.update({
      where: { id },
      data: {
        ...(validated.name && { name: validated.name }),
        ...(validated.description !== undefined && { description: validated.description }),
        ...(validated.status && { status: validated.status }),
        ...(validated.startDate !== undefined && { startDate: validated.startDate ? new Date(validated.startDate) : null }),
        ...(validated.deadline !== undefined && { deadline: validated.deadline ? new Date(validated.deadline) : null }),
        ...(validated.isArchived !== undefined && { isArchived: validated.isArchived }),
      },
      include: {
        manager: { select: { id: true, name: true, email: true } },
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    await logActivity({
      userId: req.user!.id,
      projectId: updated.id,
      action: 'PROJECT_UPDATED',
      details: `Project updated with status: ${updated.status}`,
    });

    res.json({
      success: true,
      message: 'Project updated successfully',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/projects/:id/members
router.post('/:id/members', authenticate, authorize(['ADMIN', 'PROJECT_MANAGER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { userId } = z.object({ userId: z.string() }).parse(req.body);

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) throw new AppError('Project not found', 404);

    if (req.user!.role !== 'ADMIN' && project.managerId !== req.user!.id) {
      throw new AppError('Forbidden: Only the project manager or admin can manage members', 403);
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404);

    const membership = await prisma.projectMember.upsert({
      where: {
        projectId_userId: { projectId: id, userId },
      },
      update: {},
      create: { projectId: id, userId },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });

    await logActivity({
      userId: req.user!.id,
      projectId: id,
      action: 'MEMBER_ADDED',
      details: `Added ${user.name} to project`,
    });

    res.status(201).json({
      success: true,
      message: 'Member added to project',
      data: membership,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/projects/:id/members/:userId
router.delete('/:id/members/:userId', authenticate, authorize(['ADMIN', 'PROJECT_MANAGER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.params.userId as string;

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) throw new AppError('Project not found', 404);

    if (req.user!.role !== 'ADMIN' && project.managerId !== req.user!.id) {
      throw new AppError('Forbidden: Only the project manager or admin can remove members', 403);
    }

    await prisma.projectMember.deleteMany({
      where: { projectId: id, userId },
    });

    await logActivity({
      userId: req.user!.id,
      projectId: id,
      action: 'MEMBER_REMOVED',
      details: `Removed member from project`,
    });

    res.json({
      success: true,
      message: 'Member removed from project',
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/projects/:id
router.delete('/:id', authenticate, authorize(['ADMIN', 'PROJECT_MANAGER']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) throw new AppError('Project not found', 404);

    if (req.user!.role !== 'ADMIN' && project.managerId !== req.user!.id) {
      throw new AppError('Forbidden: Only the project manager or admin can delete this project', 403);
    }

    await prisma.project.delete({ where: { id } });

    res.json({
      success: true,
      message: 'Project deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
