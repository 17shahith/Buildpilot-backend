import { NextFunction, Request, RequestHandler, Response } from 'express';
import { verifyAccessToken } from './auth';
import { getConfig } from './config';
import { isTokenRevoked } from './revocation';

export type AuthenticatedRequest = Request & {
  user?: { id: string; role: string };
};

export const asyncHandler = (handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => { void handler(req, res, next).catch(next); };

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.get('authorization');
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  try {
    const token = header.slice(7).trim();
    const claims = verifyAccessToken(token);
    if (await isTokenRevoked(token)) {
      res.status(401).json({ error: 'Token has been revoked' });
      return;
    }
    (req as AuthenticatedRequest).user = { id: claims.sub, role: claims.role };
    next();
  } catch (error) {
    if (getConfig().nodeEnv === 'production' && error instanceof Error && error.message.includes('revocation')) {
      res.status(503).json({ error: 'Authentication service unavailable' });
      return;
    }
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: string[]): RequestHandler {
  return (req, res, next) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user || !roles.includes(user.role)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  };
}

export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  const config = getConfig();
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  if (config.nodeEnv === 'production') res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const config = getConfig();
  console.error('[API Error]', error instanceof Error ? error.message : 'Unknown error');
  if (res.headersSent) return;
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
    res.status(409).json({ error: 'A resource with those unique values already exists' });
    return;
  }
  const status = (error as { status?: number })?.status;
  res.status(typeof status === 'number' && status >= 400 && status < 500 ? status : 500).json({
    error: config.nodeEnv === 'production' ? 'Internal server error' : error instanceof Error ? error.message : 'Internal server error'
  });
}
