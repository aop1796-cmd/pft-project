/**
 * Reports routes – create/update draft, submit, grade, PDF export
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

export const reportsRouter = Router();

// ── Validation Schema ─────────────────────────────────────────────────────

const reportSchema = z.object({
  meanE: z.number().min(0).max(1.2),
  referenceE: z.number().min(0).max(1.2),
  percentError: z.number(),
  conclusion: z.string().min(10),
  sourcesOfError: z.array(z.string()).default([]),
  precautions: z.array(z.string()).default([]),
});

// ── POST /api/reports (create or update draft) ───────────────────────────

reportsRouter.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = reportSchema.parse(req.body);

    // Upsert draft – one report per user (update if draft exists)
    const existing = await prisma.report.findFirst({
      where: { userId: req.user!.userId, status: 'DRAFT' },
    });

    const reportData = {
      meanE: body.meanE,
      referenceE: body.referenceE,
      percentError: body.percentError,
      conclusion: body.conclusion,
      sourcesOfError: body.sourcesOfError,
      precautions: body.precautions,
    };

    let report;
    if (existing) {
      report = await prisma.report.update({ where: { id: existing.id }, data: reportData });
    } else {
      report = await prisma.report.create({
        data: { ...reportData, userId: req.user!.userId, status: 'DRAFT' },
      });
    }

    res.status(existing ? 200 : 201).json({ success: true, data: report });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.errors.map((e) => e.message).join(', '), 400));
    }
    next(err);
  }
});

// ── GET /api/reports/me ────────────────────────────────────────────────────

reportsRouter.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reports = await prisma.report.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: reports });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/reports/:id/submit ──────────────────────────────────────────

reportsRouter.post('/:id/submit', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const report = await prisma.report.findUnique({ where: { id: req.params.id } });
    if (!report) throw new AppError('Report not found', 404);
    if (report.userId !== req.user!.userId) throw new AppError('Forbidden', 403);
    if (report.status !== 'DRAFT') throw new AppError('Report already submitted', 400);

    const updated = await prisma.report.update({
      where: { id: req.params.id },
      data: { status: 'SUBMITTED', submittedAt: new Date() },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/reports/:id/pdf ──────────────────────────────────────────────
// Generates an HTML page for the PDF (consumed by the browser print function)

reportsRouter.get('/:id/pdf', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const report = await prisma.report.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { name: true, email: true, rollNo: true, division: true } } },
    });

    if (!report) throw new AppError('Report not found', 404);
    if (report.userId !== req.user!.userId) throw new AppError('Forbidden', 403);

    // Return JSON with report data for client-side PDF generation
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
});
