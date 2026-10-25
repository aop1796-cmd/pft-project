/**
 * Teacher dashboard routes – students, submissions, grading, analytics
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

export const teacherRouter = Router();

// All teacher routes require TEACHER or ADMIN role
teacherRouter.use(authenticate, authorize('TEACHER', 'ADMIN'));

// ── GET /api/teacher/students ──────────────────────────────────────────────

teacherRouter.get('/students', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const students = await prisma.user.findMany({
      where: { role: 'STUDENT' },
      select: {
        id: true, name: true, email: true, rollNo: true, division: true, createdAt: true,
        _count: { select: { trials: true, reports: true, quizAttempts: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: students });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/teacher/reports?status=SUBMITTED ─────────────────────────────

teacherRouter.get('/reports', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string | undefined;
    const validStatuses = ['DRAFT', 'SUBMITTED', 'GRADED'];

    const reports = await prisma.report.findMany({
      where: status && validStatuses.includes(status) ? { status: status as any } : undefined,
      include: {
        user: { select: { name: true, email: true, rollNo: true, division: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });

    res.json({ success: true, data: reports });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/teacher/reports/:id/grade ──────────────────────────────────

teacherRouter.patch('/reports/:id/grade', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      marks: z.number().min(0).max(100),
      teacherRemarks: z.string().optional(),
    });

    const body = schema.parse(req.body);

    const report = await prisma.report.findUnique({ where: { id: req.params.id } });
    if (!report) throw new AppError('Report not found', 404);
    if (report.status !== 'SUBMITTED') {
      throw new AppError('Can only grade submitted reports', 400);
    }

    const updated = await prisma.report.update({
      where: { id: req.params.id },
      data: {
        marks: body.marks,
        teacherRemarks: body.teacherRemarks,
        status: 'GRADED',
        gradedBy: req.user!.userId,
        gradedAt: new Date(),
      },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.errors.map((e) => e.message).join(', '), 400));
    }
    next(err);
  }
});

// ── GET /api/teacher/analytics ────────────────────────────────────────────

teacherRouter.get('/analytics', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [reports, quizAttempts, trialCount, studentCount] = await Promise.all([
      prisma.report.findMany({ select: { meanE: true, percentError: true, status: true, marks: true } }),
      prisma.quizAttempt.findMany({ select: { score: true, total: true } }),
      prisma.trial.count(),
      prisma.user.count({ where: { role: 'STUDENT' } }),
    ]);

    const gradedReports = reports.filter((r) => r.marks !== null);
    const avgMarks = gradedReports.length
      ? gradedReports.reduce((s, r) => s + (r.marks || 0), 0) / gradedReports.length
      : 0;

    const avgE = reports.length
      ? reports.reduce((s, r) => s + r.meanE, 0) / reports.length
      : 0;

    const avgPercentError = reports.length
      ? reports.reduce((s, r) => s + r.percentError, 0) / reports.length
      : 0;

    const avgQuizScore = quizAttempts.length
      ? quizAttempts.reduce((s, a) => s + (a.score / a.total) * 100, 0) / quizAttempts.length
      : 0;

    const statusBreakdown = {
      DRAFT: reports.filter((r) => r.status === 'DRAFT').length,
      SUBMITTED: reports.filter((r) => r.status === 'SUBMITTED').length,
      GRADED: reports.filter((r) => r.status === 'GRADED').length,
    };

    // Error distribution buckets
    const errorBuckets: Record<string, number> = {
      '0-5%': 0, '5-10%': 0, '10-20%': 0, '20%+': 0,
    };
    for (const r of reports) {
      const pct = Math.abs(r.percentError);
      if (pct <= 5) errorBuckets['0-5%']++;
      else if (pct <= 10) errorBuckets['5-10%']++;
      else if (pct <= 20) errorBuckets['10-20%']++;
      else errorBuckets['20%+']++;
    }

    res.json({
      success: true,
      data: {
        studentCount,
        trialCount,
        reportCount: reports.length,
        statusBreakdown,
        avgE: Number(avgE.toFixed(4)),
        avgPercentError: Number(avgPercentError.toFixed(2)),
        avgMarks: Number(avgMarks.toFixed(2)),
        avgQuizScore: Number(avgQuizScore.toFixed(2)),
        quizAttemptCount: quizAttempts.length,
        errorDistribution: errorBuckets,
      },
    });
  } catch (err) {
    next(err);
  }
});
