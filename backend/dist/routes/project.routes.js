"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkProjectAccess = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = __importDefault(require("../config/db"));
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const activityLogger_1 = require("../utils/activityLogger");
const router = (0, express_1.Router)();
const createProjectSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Project name is required'),
    description: zod_1.z.string().optional(),
    status: zod_1.z.enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED']).optional().default('ACTIVE'),
    startDate: zod_1.z.string().datetime().optional().nullable(),
    deadline: zod_1.z.string().datetime().optional().nullable(),
    memberIds: zod_1.z.array(zod_1.z.string()).optional(),
});
const updateProjectSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).optional(),
    description: zod_1.z.string().optional().nullable(),
    status: zod_1.z.enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED']).optional(),
    startDate: zod_1.z.string().datetime().optional().nullable(),
    deadline: zod_1.z.string().datetime().optional().nullable(),
    isArchived: zod_1.z.boolean().optional(),
});
const checkProjectAccess = async (projectId, user) => {
    if (user.role === 'ADMIN')
        return true;
    const project = await db_1.default.project.findUnique({
        where: { id: projectId },
        include: {
            members: { select: { userId: true } },
        },
    });
    if (!project)
        return false;
    if (project.managerId === user.id)
        return true;
    return project.members.some((m) => m.userId === user.id);
};
exports.checkProjectAccess = checkProjectAccess;
// GET /api/projects
router.get('/', auth_1.authenticate, async (req, res, next) => {
    try {
        const user = req.user;
        const { status, search, includeArchived } = req.query;
        const where = {};
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
        }
        else if (user.role === 'PROJECT_MANAGER') {
            where.OR = [
                { managerId: user.id },
                { members: { some: { userId: user.id } } },
            ];
        }
        const projects = await db_1.default.project.findMany({
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
        const enrichedProjects = await Promise.all(projects.map(async (project) => {
            const completedTasks = await db_1.default.task.count({
                where: { projectId: project.id, status: 'DONE' },
            });
            const totalTasks = project._count.tasks;
            const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
            return {
                ...project,
                completedTasks,
                progress,
            };
        }));
        res.json({
            success: true,
            data: enrichedProjects,
        });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/projects
router.post('/', auth_1.authenticate, (0, auth_1.authorize)(['ADMIN', 'PROJECT_MANAGER']), async (req, res, next) => {
    try {
        const validated = createProjectSchema.parse(req.body);
        const project = await db_1.default.project.create({
            data: {
                name: validated.name.trim(),
                description: validated.description?.trim(),
                status: validated.status,
                startDate: validated.startDate ? new Date(validated.startDate) : null,
                deadline: validated.deadline ? new Date(validated.deadline) : null,
                managerId: req.user.id,
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
        await (0, activityLogger_1.logActivity)({
            userId: req.user.id,
            projectId: project.id,
            action: 'PROJECT_CREATED',
            details: `Project "${project.name}" was created`,
        });
        res.status(201).json({
            success: true,
            message: 'Project created successfully',
            data: project,
        });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/projects/:id
router.get('/:id', auth_1.authenticate, async (req, res, next) => {
    try {
        const id = req.params.id;
        const hasAccess = await (0, exports.checkProjectAccess)(id, req.user);
        if (!hasAccess) {
            throw new errorHandler_1.AppError('You do not have permission to view this project', 403);
        }
        const project = await db_1.default.project.findUnique({
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
            throw new errorHandler_1.AppError('Project not found', 404);
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
    }
    catch (error) {
        next(error);
    }
});
// PATCH /api/projects/:id
router.patch('/:id', auth_1.authenticate, (0, auth_1.authorize)(['ADMIN', 'PROJECT_MANAGER']), async (req, res, next) => {
    try {
        const id = req.params.id;
        const validated = updateProjectSchema.parse(req.body);
        const existing = await db_1.default.project.findUnique({ where: { id } });
        if (!existing) {
            throw new errorHandler_1.AppError('Project not found', 404);
        }
        if (req.user.role !== 'ADMIN' && existing.managerId !== req.user.id) {
            throw new errorHandler_1.AppError('Forbidden: Only the project manager or an admin can edit this project', 403);
        }
        const updated = await db_1.default.project.update({
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
        await (0, activityLogger_1.logActivity)({
            userId: req.user.id,
            projectId: updated.id,
            action: 'PROJECT_UPDATED',
            details: `Project updated with status: ${updated.status}`,
        });
        res.json({
            success: true,
            message: 'Project updated successfully',
            data: updated,
        });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/projects/:id/members
router.post('/:id/members', auth_1.authenticate, (0, auth_1.authorize)(['ADMIN', 'PROJECT_MANAGER']), async (req, res, next) => {
    try {
        const id = req.params.id;
        const { userId } = zod_1.z.object({ userId: zod_1.z.string() }).parse(req.body);
        const project = await db_1.default.project.findUnique({ where: { id } });
        if (!project)
            throw new errorHandler_1.AppError('Project not found', 404);
        if (req.user.role !== 'ADMIN' && project.managerId !== req.user.id) {
            throw new errorHandler_1.AppError('Forbidden: Only the project manager or admin can manage members', 403);
        }
        const user = await db_1.default.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new errorHandler_1.AppError('User not found', 404);
        const membership = await db_1.default.projectMember.upsert({
            where: {
                projectId_userId: { projectId: id, userId },
            },
            update: {},
            create: { projectId: id, userId },
            include: { user: { select: { id: true, name: true, email: true, role: true } } },
        });
        await (0, activityLogger_1.logActivity)({
            userId: req.user.id,
            projectId: id,
            action: 'MEMBER_ADDED',
            details: `Added ${user.name} to project`,
        });
        res.status(201).json({
            success: true,
            message: 'Member added to project',
            data: membership,
        });
    }
    catch (error) {
        next(error);
    }
});
// DELETE /api/projects/:id/members/:userId
router.delete('/:id/members/:userId', auth_1.authenticate, (0, auth_1.authorize)(['ADMIN', 'PROJECT_MANAGER']), async (req, res, next) => {
    try {
        const id = req.params.id;
        const userId = req.params.userId;
        const project = await db_1.default.project.findUnique({ where: { id } });
        if (!project)
            throw new errorHandler_1.AppError('Project not found', 404);
        if (req.user.role !== 'ADMIN' && project.managerId !== req.user.id) {
            throw new errorHandler_1.AppError('Forbidden: Only the project manager or admin can remove members', 403);
        }
        await db_1.default.projectMember.deleteMany({
            where: { projectId: id, userId },
        });
        await (0, activityLogger_1.logActivity)({
            userId: req.user.id,
            projectId: id,
            action: 'MEMBER_REMOVED',
            details: `Removed member from project`,
        });
        res.json({
            success: true,
            message: 'Member removed from project',
        });
    }
    catch (error) {
        next(error);
    }
});
// DELETE /api/projects/:id
router.delete('/:id', auth_1.authenticate, (0, auth_1.authorize)(['ADMIN', 'PROJECT_MANAGER']), async (req, res, next) => {
    try {
        const id = req.params.id;
        const project = await db_1.default.project.findUnique({ where: { id } });
        if (!project)
            throw new errorHandler_1.AppError('Project not found', 404);
        if (req.user.role !== 'ADMIN' && project.managerId !== req.user.id) {
            throw new errorHandler_1.AppError('Forbidden: Only the project manager or admin can delete this project', 403);
        }
        await db_1.default.project.delete({ where: { id } });
        res.json({
            success: true,
            message: 'Project deleted successfully',
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
