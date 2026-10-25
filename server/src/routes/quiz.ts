/**
 * Quiz routes – questions, attempts, and scoring
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

export const quizRouter = Router();

// ── GET /api/quiz/questions?type=MCQ|VIVA ─────────────────────────────────

quizRouter.get('/questions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const type = req.query.type as string | undefined;
    const validTypes = ['MCQ', 'VIVA'];

    const questions = await prisma.quizQuestion.findMany({
      where: type && validTypes.includes(type) ? { type: type as 'MCQ' | 'VIVA' } : undefined,
      orderBy: { orderIndex: 'asc' },
    });

    res.json({ success: true, data: questions });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/quiz/attempts ───────────────────────────────────────────────

quizRouter.post('/attempts', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      answers: z.record(z.string()), // { questionId: selectedAnswer }
    });

    const { answers } = schema.parse(req.body);

    // Fetch all MCQ questions to score
    const questions = await prisma.quizQuestion.findMany({ where: { type: 'MCQ' } });
    let score = 0;
    const total = questions.length;

    for (const q of questions) {
      if (answers[q.id] === q.answer) {
        score++;
      }
    }

    const attempt = await prisma.quizAttempt.create({
      data: {
        userId: req.user!.userId,
        score,
        total,
        answers,
      },
    });

    res.status(201).json({
      success: true,
      data: { ...attempt, percentage: Math.round((score / total) * 100) },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.errors.map((e) => e.message).join(', '), 400));
    }
    next(err);
  }
});

// ── GET /api/quiz/attempts/me ─────────────────────────────────────────────

quizRouter.get('/attempts/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attempts = await prisma.quizAttempt.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: attempts });
  } catch (err) {
    next(err);
  }
});
