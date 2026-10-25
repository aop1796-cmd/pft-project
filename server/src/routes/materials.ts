/**
 * Materials routes – read material presets
 */

import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

export const materialsRouter = Router();

// GET /api/materials
materialsRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const materials = await prisma.material.findMany({ orderBy: { referenceE: 'desc' } });
    res.json({ success: true, data: materials });
  } catch (err) {
    next(err);
  }
});
