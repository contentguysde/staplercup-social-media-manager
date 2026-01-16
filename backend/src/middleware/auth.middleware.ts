import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../services/auth.service';
import type { TokenPayload, Role } from '../types/auth';

export interface AuthRequest extends Request {
  user?: TokenPayload;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentifizierung erforderlich' });
      return;
    }

    const token = authHeader.substring(7);
    const payload = verifyAccessToken(token);

    req.user = payload;
    next();
  } catch (error) {
    // Check if token is expired
    if (error instanceof Error && error.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Token abgelaufen', code: 'TOKEN_EXPIRED' });
      return;
    }

    res.status(401).json({ error: 'Ungültiger Token' });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentifizierung erforderlich' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Keine Berechtigung für diese Aktion' });
      return;
    }

    next();
  };
}

// Optional auth - doesn't fail if no token, but adds user to req if present
export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = verifyAccessToken(token);
      req.user = payload;
    }
  } catch {
    // Ignore errors, just don't set user
  }

  next();
}
