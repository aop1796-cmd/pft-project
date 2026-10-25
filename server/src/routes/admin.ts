/**
 * Admin routes – manage users, quiz questions, materials
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

export const adminRouter = Router();

// All admin routes require ADMIN role
adminRouter.use(authenticate, authorize('ADMIN'));

// ══════════════════════════════════════════════════════════════════════════
// USERS
// ══════════════════════════════════════════════════════════════════════════

// GET /api/admin/users
adminRouter.get('/users', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, rollNo: true, division: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: users });
  } catch (err) { next(err); }
});

// POST /api/admin/users
adminRouter.post('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      name: z.string().min(2),
      email: z.string().email().toLowerCase(),
      password: z.string().min(6),
      role: z.enum(['STUDENT', 'TEACHER', 'ADMIN']),
      rollNo: z.string().optional(),
      division: z.string().optional(),
    });
    const body = schema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) throw new AppError('Email already in use', 409);
    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await prisma.user.create({
      data: { ...body, passwordHash },
      select: { id: true, name: true, email: true, role: true },
    });
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(err.errors.map((e) => e.message).join(', '), 400));
    next(err);
  }
});

// PATCH /api/admin/users/:id
adminRouter.patch('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      name: z.string().min(2).optional(),
      role: z.enum(['STUDENT', 'TEACHER', 'ADMIN']).optional(),
      rollNo: z.string().optional(),
      division: z.string().optional(),
    });
    const body = schema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: body,
      select: { id: true, name: true, email: true, role: true },
    });
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
});

// DELETE /api/admin/users/:id
adminRouter.delete('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.params.id === req.user!.userId) throw new AppError('Cannot delete yourself', 400);
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'User deleted' });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════════
// QUIZ QUESTIONS
// ══════════════════════════════════════════════════════════════════════════

const questionSchema = z.object({
  type: z.enum(['MCQ', 'VIVA']),
  question: z.string().min(5),
  options: z.array(z.string()).optional(),
  answer: z.string().min(1),
  explanation: z.string().optional(),
  orderIndex: z.number().int().optional(),
});

adminRouter.get('/questions', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const questions = await prisma.quizQuestion.findMany({ orderBy: { orderIndex: 'asc' } });
    res.json({ success: true, data: questions });
  } catch (err) { next(err); }
});

adminRouter.post('/questions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = questionSchema.parse(req.body);
    const q = await prisma.quizQuestion.create({ data: body });
    res.status(201).json({ success: true, data: q });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(err.errors.map((e) => e.message).join(', '), 400));
    next(err);
  }
});

adminRouter.patch('/questions/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = questionSchema.partial().parse(req.body);
    const q = await prisma.quizQuestion.update({ where: { id: req.params.id }, data: body });
    res.json({ success: true, data: q });
  } catch (err) { next(err); }
});

adminRouter.delete('/questions/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.quizQuestion.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Question deleted' });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════════
// MATERIALS
// ══════════════════════════════════════════════════════════════════════════

const materialSchema = z.object({
  name: z.string().min(1),
  referenceE: z.number().min(0).max(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  density: z.number().positive().optional(),
  description: z.string().optional(),
});

adminRouter.get('/materials', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const materials = await prisma.material.findMany({ orderBy: { name: 'asc' } });
    res.json({ success: true, data: materials });
  } catch (err) { next(err); }
});

adminRouter.post('/materials', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = materialSchema.parse(req.body);
    const mat = await prisma.material.create({ data: body });
    res.status(201).json({ success: true, data: mat });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(err.errors.map((e) => e.message).join(', '), 400));
    next(err);
  }
});

adminRouter.patch('/materials/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = materialSchema.partial().parse(req.body);
    const mat = await prisma.material.update({ where: { id: req.params.id }, data: body });
    res.json({ success: true, data: mat });
  } catch (err) { next(err); }
});

adminRouter.delete('/materials/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.material.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Material deleted' });
  } catch (err) { next(err); }
});
