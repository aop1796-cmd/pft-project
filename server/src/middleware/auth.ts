/**
 * Authentication & Authorization middleware
 * Reads JWT from httpOnly cookie OR Authorization header (Bearer token)
 */

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../lib/jwt';
import { AppError } from './errorHandler';

// Augment the Express Request type with the authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

/**
 * Verify the access token. If valid, attach the user payload to req.user.
 * The token can come from:
 *   1. httpOnly cookie named "access_token"
 *   2. Authorization header as "Bearer <token>"
 */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const tokenFromCookie = req.cookies?.access_token as string | undefined;
    const tokenFromHeader = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : undefined;

    const token = tokenFromCookie || tokenFromHeader;
    if (!token) {
      throw new AppError('Authentication required. Please log in.', 401);
    }

    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (err: unknown) {
    if (err instanceof AppError) return next(err);
    next(new AppError('Invalid or expired token. Please log in again.', 401));
  }
}

/**
 * Role-based access control factory
 * Usage: authorize('TEACHER', 'ADMIN')
 */
export function authorize(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Not authenticated', 401));
    }
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError(`Access denied. Requires role: ${roles.join(' or ')}`, 403)
      );
    }
    next();
  };
}

/**
 * Optional authentication – does NOT throw if no token is present.
 * Useful for routes that work for both guests and authenticated users.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token =
      req.cookies?.access_token ||
      req.headers.authorization?.slice(7);

    if (token) {
      req.user = verifyAccessToken(token);
    }
  } catch {
    // Token is present but invalid – ignore silently
  }
  next();
}
