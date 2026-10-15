"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const db_1 = __importDefault(require("../config/db"));
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const activityLogger_1 = require("../utils/activityLogger");
const router = (0, express_1.Router)();
const registerSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Name must be at least 2 characters'),
    email: zod_1.z.string().email('Valid email address is required'),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
    role: zod_1.z.enum(['ADMIN', 'PROJECT_MANAGER', 'TEAM_MEMBER']).optional().default('TEAM_MEMBER'),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Valid email address is required'),
    password: zod_1.z.string().min(1, 'Password is required'),
});
// POST /api/auth/register
router.post('/register', async (req, res, next) => {
    try {
        const validated = registerSchema.parse(req.body);
        const existingUser = await db_1.default.user.findUnique({
            where: { email: validated.email.toLowerCase() },
        });
        if (existingUser) {
            throw new errorHandler_1.AppError('An account with this email already exists', 409);
        }
        const hashedPassword = await bcryptjs_1.default.hash(validated.password, 10);
        const user = await db_1.default.user.create({
            data: {
                name: validated.name.trim(),
                email: validated.email.toLowerCase(),
                password: hashedPassword,
                role: validated.role,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true,
            },
        });
        const secret = process.env.JWT_SECRET || 'supersecretjwtkey';
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role }, secret, { expiresIn: '7d' });
        await (0, activityLogger_1.logActivity)({
            userId: user.id,
            action: 'USER_REGISTERED',
            details: `User registered with role ${user.role}`,
        });
        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                user,
                token,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/auth/login
router.post('/login', async (req, res, next) => {
    try {
        const validated = loginSchema.parse(req.body);
        const user = await db_1.default.user.findUnique({
            where: { email: validated.email.toLowerCase() },
        });
        if (!user) {
            throw new errorHandler_1.AppError('Invalid email or password', 401);
        }
        const isMatch = await bcryptjs_1.default.compare(validated.password, user.password);
        if (!isMatch) {
            throw new errorHandler_1.AppError('Invalid email or password', 401);
        }
        const secret = process.env.JWT_SECRET || 'supersecretjwtkey';
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role }, secret, { expiresIn: '7d' });
        await (0, activityLogger_1.logActivity)({
            userId: user.id,
            action: 'USER_LOGGED_IN',
            details: 'User logged in successfully',
        });
        res.json({
            success: true,
            message: 'Login successful',
            data: {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    createdAt: user.createdAt,
                },
                token,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/auth/me
router.get('/me', auth_1.authenticate, async (req, res, next) => {
    try {
        res.json({
            success: true,
            data: {
                user: req.user,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
