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
const router = (0, express_1.Router)();
// GET /api/users - List users (Admin / Project Manager or all authenticated users for assignee selection)
router.get('/', auth_1.authenticate, async (req, res, next) => {
    try {
        const { role, search } = req.query;
        const where = {};
        if (role && typeof role === 'string') {
            where.role = role;
        }
        if (search && typeof search === 'string') {
            where.OR = [
                { name: { contains: search } },
                { email: { contains: search } },
            ];
        }
        const users = await db_1.default.user.findMany({
            where,
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true,
            },
            orderBy: { name: 'asc' },
        });
        res.json({
            success: true,
            data: users,
        });
    }
    catch (error) {
        next(error);
    }
});
// PATCH /api/users/:id/role - Update user role (Admin only)
const updateRoleSchema = zod_1.z.object({
    role: zod_1.z.enum(['ADMIN', 'PROJECT_MANAGER', 'TEAM_MEMBER']),
});
router.patch('/:id/role', auth_1.authenticate, (0, auth_1.authorize)(['ADMIN']), async (req, res, next) => {
    try {
        const id = req.params.id;
        const { role } = updateRoleSchema.parse(req.body);
        const targetUser = await db_1.default.user.findUnique({ where: { id } });
        if (!targetUser) {
            throw new errorHandler_1.AppError('User not found', 404);
        }
        const updated = await db_1.default.user.update({
            where: { id },
            data: { role },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                updatedAt: true,
            },
        });
        res.json({
            success: true,
            message: 'User role updated successfully',
            data: updated,
        });
    }
    catch (error) {
        next(error);
    }
});
// DELETE /api/users/:id - Delete a user (Admin only)
router.delete('/:id', auth_1.authenticate, (0, auth_1.authorize)(['ADMIN']), async (req, res, next) => {
    try {
        const id = req.params.id;
        if (req.user?.id === id) {
            throw new errorHandler_1.AppError('You cannot delete your own account', 400);
        }
        await db_1.default.user.delete({ where: { id } });
        res.json({
            success: true,
            message: 'User deleted successfully',
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
