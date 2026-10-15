import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/db';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { logActivity } from '../utils/activityLogger';
import { checkProjectAccess } from './project.routes';

const router = Router();

const createTaskSchema = z.object({
  title: z.string().min(2, 'Task title is required'),
  description: z.string().optional(),
  projectId: z.string().min(1, 'Valid project ID is required'),
  assigneeId: z.string().optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional().default('MEDIUM'),
  status: z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']).optional().default('TODO'),
  dueDate: z.string().datetime().optional().nullable(),
});

const updateTaskSchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']).optional(),
  dueDate: z.string().datetime().optional().nullable(),
});

const createCommentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty'),
});

// GET /api/tasks
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const {
      projectId,
      assigneeId,
      priority,
      status,
      search,
      sortBy = 'createdAt',
      order = 'desc',
      page = '1',
      limit = '10',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (projectId && typeof projectId === 'string') {
      where.projectId = projectId;
    }

    if (assigneeId && typeof assigneeId === 'string') {
      where.assigneeId = assigneeId;
    }

    if (priority && typeof priority === 'string') {
      where.priority = priority;
    }

    if (status && typeof status === 'string') {
      where.status = status;
    }

    if (search && typeof search === 'string') {
      where.title = { contains: search };
    }

    if (user.role === 'TEAM_MEMBER') {
      where.project = {
        OR: [
          { members: { some: { userId: user.id } } },
          { managerId: user.id },
        ],
      };
    } else if (user.role === 'PROJECT_MANAGER') {
      where.project = {
        OR: [
          { managerId: user.id },
          { members: { some: { userId: user.id } } },
        ],
      };
    }

    const sortOrder = order === 'asc' ? 'asc' : 'desc';
    const orderByField: any = {};
    if (['createdAt', 'updatedAt', 'dueDate', 'priority', 'status', 'title'].includes(sortBy as string)) {
      orderByField[sortBy as string] = sortOrder;
    } else {
      orderByField.createdAt = 'desc';
    }

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: {
          project: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true, email: true } },
          creator: { select: { id: true, name: true } },
          _count: { select: { comments: true } },
        },
        orderBy: orderByField,
        skip,
        take: limitNum,
      }),
      prisma.task.count({ where }),
    ]);

    res.json({
      success: true,
      data: tasks,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/tasks
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = createTaskSchema.parse(req.body);

    const hasAccess = await checkProjectAccess(validated.projectId, req.user!);
    if (!hasAccess) {
      throw new AppError('Forbidden: You do not have access to this project', 403);
    }

    if (req.user!.role === 'TEAM_MEMBER') {
      throw new AppError('Forbidden: Only Project Managers and Admins can create tasks', 403);
    }

    const task = await prisma.task.create({
      data: {
        title: validated.title.trim(),
        description: validated.description?.trim(),
        projectId: validated.projectId,
        assigneeId: validated.assigneeId || null,
        priority: validated.priority,
        status: validated.status,
        dueDate: validated.dueDate ? new Date(validated.dueDate) : null,
        creatorId: req.user!.id,
      },
      include: {
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true } },
      },
    });

    await logActivity({
      userId: req.user!.id,
      projectId: task.projectId,
      taskId: task.id,
      action: 'TASK_CREATED',
      details: `Created task "${task.title}"`,
    });

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: task,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/tasks/:id
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true, managerId: true } },
        assignee: { select: { id: true, name: true, email: true, role: true } },
        creator: { select: { id: true, name: true } },
        comments: {
          include: {
            author: { select: { id: true, name: true, email: true, role: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        activityLogs: {
          include: {
            user: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!task) {
      throw new AppError('Task not found', 404);
    }

    const hasAccess = await checkProjectAccess(task.projectId, req.user!);
    if (!hasAccess) {
      throw new AppError('Forbidden: You do not have permission to view this task', 403);
    }

    res.json({
      success: true,
      data: task,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/tasks/:id
router.patch('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const validated = updateTaskSchema.parse(req.body);

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, managerId: true } },
      },
    });

    if (!task) {
      throw new AppError('Task not found', 404);
    }

    const isAuthorized = await checkProjectAccess(task.projectId, req.user!);
    if (!isAuthorized) {
      throw new AppError('Forbidden: Access denied', 403);
    }

    if (req.user!.role === 'TEAM_MEMBER') {
      if (task.assigneeId !== req.user!.id) {
        throw new AppError('Forbidden: You can only update tasks assigned to you', 403);
      }
      if (validated.title || validated.assigneeId || validated.dueDate || validated.priority) {
        throw new AppError('Forbidden: Team members can only update task status', 403);
      }
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        ...(validated.title && { title: validated.title.trim() }),
        ...(validated.description !== undefined && { description: validated.description?.trim() }),
        ...(validated.assigneeId !== undefined && { assigneeId: validated.assigneeId }),
        ...(validated.priority && { priority: validated.priority }),
        ...(validated.status && { status: validated.status }),
        ...(validated.dueDate !== undefined && { dueDate: validated.dueDate ? new Date(validated.dueDate) : null }),
      },
      include: {
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true } },
      },
    });

    let action = 'TASK_UPDATED';
    let details = `Updated task "${updatedTask.title}"`;

    if (validated.status && validated.status !== task.status) {
      action = 'TASK_STATUS_CHANGED';
      details = `Changed status from ${task.status} to ${validated.status}`;
    } else if (validated.assigneeId !== undefined && validated.assigneeId !== task.assigneeId) {
      action = 'TASK_ASSIGNED';
      details = `Reassigned task`;
    }

    await logActivity({
      userId: req.user!.id,
      projectId: updatedTask.projectId,
      taskId: updatedTask.id,
      action,
      details,
    });

    res.json({
      success: true,
      message: 'Task updated successfully',
      data: updatedTask,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    const task = await prisma.task.findUnique({
      where: { id },
      include: { project: { select: { managerId: true } } },
    });

    if (!task) {
      throw new AppError('Task not found', 404);
    }

    if (req.user!.role !== 'ADMIN' && task.project.managerId !== req.user!.id) {
      throw new AppError('Forbidden: Only the project manager or an admin can delete tasks', 403);
    }

    await prisma.task.delete({ where: { id } });

    await logActivity({
      userId: req.user!.id,
      projectId: task.projectId,
      action: 'TASK_DELETED',
      details: `Deleted task "${task.title}"`,
    });

    res.json({
      success: true,
      message: 'Task deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/tasks/:id/comments
router.post('/:id/comments', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { content } = createCommentSchema.parse(req.body);

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) {
      throw new AppError('Task not found', 404);
    }

    const hasAccess = await checkProjectAccess(task.projectId, req.user!);
    if (!hasAccess) {
      throw new AppError('Forbidden: You do not have access to comment on this task', 403);
    }

    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
        taskId: id,
        authorId: req.user!.id,
      },
      include: {
        author: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    await logActivity({
      userId: req.user!.id,
      projectId: task.projectId,
      taskId: id,
      action: 'COMMENT_ADDED',
      details: `Added a comment on task "${task.title}"`,
    });

    res.status(201).json({
      success: true,
      message: 'Comment posted successfully',
      data: comment,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
