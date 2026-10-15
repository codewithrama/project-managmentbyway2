import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../config/db';
import { authenticate, authorize } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// GET /api/users - List users (Admin / Project Manager or all authenticated users for assignee selection)
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, search } = req.query;

    const where: any = {};
    if (role && typeof role === 'string') {
      where.role = role;
    }
    if (search && typeof search === 'string') {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const users = await prisma.user.findMany({
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
  } catch (error) {
    next(error);
  }
});

// PATCH /api/users/:id/role - Update user role (Admin only)
const updateRoleSchema = z.object({
  role: z.enum(['ADMIN', 'PROJECT_MANAGER', 'TEAM_MEMBER']),
});

router.patch('/:id/role', authenticate, authorize(['ADMIN']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { role } = updateRoleSchema.parse(req.body);

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      throw new AppError('User not found', 404);
    }

    const updated = await prisma.user.update({
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
  } catch (error) {
    next(error);
  }
});

// DELETE /api/users/:id - Delete a user (Admin only)
router.delete('/:id', authenticate, authorize(['ADMIN']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    if (req.user?.id === id) {
      throw new AppError('You cannot delete your own account', 400);
    }

    await prisma.user.delete({ where: { id } });

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
