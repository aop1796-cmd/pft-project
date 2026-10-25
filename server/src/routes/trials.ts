/**
 * Trials routes – CRUD for experiment observations
 * Supports guest mode (no auth) and authenticated mode (syncs to DB)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, optionalAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

export const trialsRouter = Router();

// ── Validation Schema ─────────────────────────────────────────────────────

const trialSchema = z.object({
  experimentId: z.string().optional(),
  h: z.number().min(0.05).max(0.50),
  y: z.number().min(0.3).max(1.0),
  mA: z.number().positive(),
  mB: z.number().positive(),
  material: z.string().min(1),
  XA: z.number(),
  XB: z.number().positive(),
  UA: z.number().positive(),
  UB: z.number().min(0),
  VA: z.number(),
  VB: z.number(),
  e: z.number().min(0).max(1.2), // slight margin for noise
  noiseApplied: z.boolean().optional().default(false),
});

// ── GET /api/trials ───────────────────────────────────────────────────────
// Returns all trials for the authenticated user

trialsRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const trials = await prisma.trial.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, data: trials });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/trials/export.csv ────────────────────────────────────────────
// Download all user's trials as CSV

trialsRouter.get('/export.csv', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const trials = await prisma.trial.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'asc' },
    });

    const headers = [
      'Sr.No', 'h (m)', 'y (m)', 'mA (kg)', 'mB (kg)', 'Material',
      'XA (m)', 'XB (m)', 'UA (m/s)', 'UB (m/s)', 'VA (m/s)', 'VB (m/s)', 'e', 'Date'
    ];

    const rows = trials.map((t, i) => [
      i + 1, t.h, t.y, t.mA, t.mB, t.material,
      t.XA.toFixed(4), t.XB.toFixed(4),
      t.UA.toFixed(4), t.UB.toFixed(4),
      t.VA.toFixed(4), t.VB.toFixed(4),
      t.e.toFixed(4),
      new Date(t.createdAt).toISOString(),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="experiment5_trials.csv"');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/trials ──────────────────────────────────────────────────────
// Create a new trial (authenticated) or return 401

trialsRouter.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = trialSchema.parse(req.body);

    // Find or create the default experiment
    let experiment = await prisma.experiment.findUnique({
      where: { slug: 'exp-5-collision-elastic' },
    });
    if (!experiment) {
      experiment = await prisma.experiment.create({
        data: { title: 'Experiment 5: Collision of Elastic Bodies', slug: 'exp-5-collision-elastic' },
      });
    }

    const trial = await prisma.trial.create({
      data: {
        userId: req.user!.userId,
        experimentId: body.experimentId || experiment.id,
        h: body.h,
        y: body.y,
        mA: body.mA,
        mB: body.mB,
        material: body.material,
        XA: body.XA,
        XB: body.XB,
        UA: body.UA,
        UB: body.UB,
        VA: body.VA,
        VB: body.VB,
        e: body.e,
        noiseApplied: body.noiseApplied,
      },
    });

    res.status(201).json({ success: true, data: trial });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.errors.map((e) => e.message).join(', '), 400));
    }
    next(err);
  }
});

// ── POST /api/trials/sync ─────────────────────────────────────────────────
// Sync guest trials (from localStorage) to DB after login

trialsRouter.post('/sync', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({ trials: z.array(trialSchema) });
    const { trials } = schema.parse(req.body);

    let experiment = await prisma.experiment.findUnique({
      where: { slug: 'exp-5-collision-elastic' },
    });
    if (!experiment) {
      experiment = await prisma.experiment.create({
        data: { title: 'Experiment 5: Collision of Elastic Bodies', slug: 'exp-5-collision-elastic' },
      });
    }

    const created = await prisma.trial.createMany({
      data: trials.map((t) => ({
        userId: req.user!.userId,
        experimentId: experiment!.id,
        h: t.h, y: t.y, mA: t.mA, mB: t.mB, material: t.material,
        XA: t.XA, XB: t.XB, UA: t.UA, UB: t.UB, VA: t.VA, VB: t.VB,
        e: t.e, noiseApplied: t.noiseApplied || false,
      })),
      skipDuplicates: true,
    });

    res.json({ success: true, message: `Synced ${created.count} trials` });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.errors.map((e) => e.message).join(', '), 400));
    }
    next(err);
  }
});

// ── DELETE /api/trials/:id ────────────────────────────────────────────────

trialsRouter.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const trial = await prisma.trial.findUnique({ where: { id: req.params.id } });
    if (!trial) throw new AppError('Trial not found', 404);
    if (trial.userId !== req.user!.userId) throw new AppError('Forbidden', 403);

    await prisma.trial.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Trial deleted' });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/trials ────────────────────────────────────────────────────
// Delete all trials for the authenticated user

trialsRouter.delete('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await prisma.trial.deleteMany({ where: { userId: req.user!.userId } });
    res.json({ success: true, message: `Deleted ${result.count} trials` });
  } catch (err) {
    next(err);
  }
});
