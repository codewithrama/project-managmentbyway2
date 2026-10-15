"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = __importDefault(require("../config/db"));
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const activityLogger_1 = require("../utils/activityLogger");
const project_routes_1 = require("./project.routes");
const router = (0, express_1.Router)();
const createTaskSchema = zod_1.z.object({
    title: zod_1.z.string().min(2, 'Task title is required'),
    description: zod_1.z.string().optional(),
    projectId: zod_1.z.string().min(1, 'Valid project ID is required'),
    assigneeId: zod_1.z.string().optional().nullable(),
    priority: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional().default('MEDIUM'),
    status: zod_1.z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']).optional().default('TODO'),
    dueDate: zod_1.z.string().datetime().optional().nullable(),
});
const updateTaskSchema = zod_1.z.object({
    title: zod_1.z.string().min(2).optional(),
    description: zod_1.z.string().optional().nullable(),
    assigneeId: zod_1.z.string().optional().nullable(),
    priority: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
    status: zod_1.z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']).optional(),
    dueDate: zod_1.z.string().datetime().optional().nullable(),
});
const createCommentSchema = zod_1.z.object({
    content: zod_1.z.string().min(1, 'Comment cannot be empty'),
});
// GET /api/tasks
router.get('/', auth_1.authenticate, async (req, res, next) => {
    try {
        const user = req.user;
        const { projectId, assigneeId, priority, status, search, sortBy = 'createdAt', order = 'desc', page = '1', limit = '10', } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
        const skip = (pageNum - 1) * limitNum;
        const where = {};
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
        }
        else if (user.role === 'PROJECT_MANAGER') {
            where.project = {
                OR: [
                    { managerId: user.id },
                    { members: { some: { userId: user.id } } },
                ],
            };
        }
        const sortOrder = order === 'asc' ? 'asc' : 'desc';
        const orderByField = {};
        if (['createdAt', 'updatedAt', 'dueDate', 'priority', 'status', 'title'].includes(sortBy)) {
            orderByField[sortBy] = sortOrder;
        }
        else {
            orderByField.createdAt = 'desc';
        }
        const [tasks, total] = await Promise.all([
            db_1.default.task.findMany({
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
            db_1.default.task.count({ where }),
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
    }
    catch (error) {
        next(error);
    }
});
// POST /api/tasks
router.post('/', auth_1.authenticate, async (req, res, next) => {
    try {
        const validated = createTaskSchema.parse(req.body);
        const hasAccess = await (0, project_routes_1.checkProjectAccess)(validated.projectId, req.user);
        if (!hasAccess) {
            throw new errorHandler_1.AppError('Forbidden: You do not have access to this project', 403);
        }
        if (req.user.role === 'TEAM_MEMBER') {
            throw new errorHandler_1.AppError('Forbidden: Only Project Managers and Admins can create tasks', 403);
        }
        const task = await db_1.default.task.create({
            data: {
                title: validated.title.trim(),
                description: validated.description?.trim(),
                projectId: validated.projectId,
                assigneeId: validated.assigneeId || null,
                priority: validated.priority,
                status: validated.status,
                dueDate: validated.dueDate ? new Date(validated.dueDate) : null,
                creatorId: req.user.id,
            },
            include: {
                project: { select: { id: true, name: true } },
                assignee: { select: { id: true, name: true, email: true } },
                creator: { select: { id: true, name: true } },
            },
        });
        await (0, activityLogger_1.logActivity)({
            userId: req.user.id,
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
    }
    catch (error) {
        next(error);
    }
});
// GET /api/tasks/:id
router.get('/:id', auth_1.authenticate, async (req, res, next) => {
    try {
        const id = req.params.id;
        const task = await db_1.default.task.findUnique({
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
            throw new errorHandler_1.AppError('Task not found', 404);
        }
        const hasAccess = await (0, project_routes_1.checkProjectAccess)(task.projectId, req.user);
        if (!hasAccess) {
            throw new errorHandler_1.AppError('Forbidden: You do not have permission to view this task', 403);
        }
        res.json({
            success: true,
            data: task,
        });
    }
    catch (error) {
        next(error);
    }
});
// PATCH /api/tasks/:id
router.patch('/:id', auth_1.authenticate, async (req, res, next) => {
    try {
        const id = req.params.id;
        const validated = updateTaskSchema.parse(req.body);
        const task = await db_1.default.task.findUnique({
            where: { id },
            include: {
                project: { select: { id: true, managerId: true } },
            },
        });
        if (!task) {
            throw new errorHandler_1.AppError('Task not found', 404);
        }
        const isAuthorized = await (0, project_routes_1.checkProjectAccess)(task.projectId, req.user);
        if (!isAuthorized) {
            throw new errorHandler_1.AppError('Forbidden: Access denied', 403);
        }
        if (req.user.role === 'TEAM_MEMBER') {
            if (task.assigneeId !== req.user.id) {
                throw new errorHandler_1.AppError('Forbidden: You can only update tasks assigned to you', 403);
            }
            if (validated.title || validated.assigneeId || validated.dueDate || validated.priority) {
                throw new errorHandler_1.AppError('Forbidden: Team members can only update task status', 403);
            }
        }
        const updatedTask = await db_1.default.task.update({
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
        }
        else if (validated.assigneeId !== undefined && validated.assigneeId !== task.assigneeId) {
            action = 'TASK_ASSIGNED';
            details = `Reassigned task`;
        }
        await (0, activityLogger_1.logActivity)({
            userId: req.user.id,
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
    }
    catch (error) {
        next(error);
    }
});
// DELETE /api/tasks/:id
router.delete('/:id', auth_1.authenticate, async (req, res, next) => {
    try {
        const id = req.params.id;
        const task = await db_1.default.task.findUnique({
            where: { id },
            include: { project: { select: { managerId: true } } },
        });
        if (!task) {
            throw new errorHandler_1.AppError('Task not found', 404);
        }
        if (req.user.role !== 'ADMIN' && task.project.managerId !== req.user.id) {
            throw new errorHandler_1.AppError('Forbidden: Only the project manager or an admin can delete tasks', 403);
        }
        await db_1.default.task.delete({ where: { id } });
        await (0, activityLogger_1.logActivity)({
            userId: req.user.id,
            projectId: task.projectId,
            action: 'TASK_DELETED',
            details: `Deleted task "${task.title}"`,
        });
        res.json({
            success: true,
            message: 'Task deleted successfully',
        });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/tasks/:id/comments
router.post('/:id/comments', auth_1.authenticate, async (req, res, next) => {
    try {
        const id = req.params.id;
        const { content } = createCommentSchema.parse(req.body);
        const task = await db_1.default.task.findUnique({ where: { id } });
        if (!task) {
            throw new errorHandler_1.AppError('Task not found', 404);
        }
        const hasAccess = await (0, project_routes_1.checkProjectAccess)(task.projectId, req.user);
        if (!hasAccess) {
            throw new errorHandler_1.AppError('Forbidden: You do not have access to comment on this task', 403);
        }
        const comment = await db_1.default.comment.create({
            data: {
                content: content.trim(),
                taskId: id,
                authorId: req.user.id,
            },
            include: {
                author: { select: { id: true, name: true, email: true, role: true } },
            },
        });
        await (0, activityLogger_1.logActivity)({
            userId: req.user.id,
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
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
