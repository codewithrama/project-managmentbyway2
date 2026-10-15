"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../config/db"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// GET /api/dashboard/summary - Retrieve calculated metrics
router.get('/summary', auth_1.authenticate, async (req, res, next) => {
    try {
        const user = req.user;
        // Project query scope
        const projectWhere = { isArchived: false };
        const taskWhere = {};
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
        }
        else if (user.role === 'PROJECT_MANAGER') {
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
        const [totalProjects, activeProjects, completedProjects, planningProjects, onHoldProjects, totalTasks, todoTasks, inProgressTasks, inReviewTasks, doneTasks, overdueTasks, myAssignedTasks, recentActivity,] = await Promise.all([
            db_1.default.project.count({ where: projectWhere }),
            db_1.default.project.count({ where: { ...projectWhere, status: 'ACTIVE' } }),
            db_1.default.project.count({ where: { ...projectWhere, status: 'COMPLETED' } }),
            db_1.default.project.count({ where: { ...projectWhere, status: 'PLANNING' } }),
            db_1.default.project.count({ where: { ...projectWhere, status: 'ON_HOLD' } }),
            db_1.default.task.count({ where: taskWhere }),
            db_1.default.task.count({ where: { ...taskWhere, status: 'TODO' } }),
            db_1.default.task.count({ where: { ...taskWhere, status: 'IN_PROGRESS' } }),
            db_1.default.task.count({ where: { ...taskWhere, status: 'IN_REVIEW' } }),
            db_1.default.task.count({ where: { ...taskWhere, status: 'DONE' } }),
            db_1.default.task.count({
                where: {
                    ...taskWhere,
                    status: { not: 'DONE' },
                    dueDate: { lt: now },
                },
            }),
            db_1.default.task.count({
                where: {
                    assigneeId: user.id,
                    status: { not: 'DONE' },
                },
            }),
            db_1.default.activityLog.findMany({
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
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
