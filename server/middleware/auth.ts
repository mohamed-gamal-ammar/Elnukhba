import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../jwt-config.js';

// Extend Express Request interface locally
export interface AuthenticatedRequest extends Request {
  user?: any;
  customerId?: string;
  adminId?: string;
}

/**
 * Middleware to authenticate requests using JWT tokens (HS256)
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : (typeof authHeader === 'string' ? authHeader : undefined);

  if (!token) {
    return res.status(401).json({ error: 'رمز الجلسة غير موجود، يرجى تسجيل الدخول' });
  }

  jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'رمز الجلسة غير صالح أو منتهي الصلاحية' });
    }
    (req as any).user = user;
    if (user && typeof user === 'object') {
      if ((user as any).id || (user as any).customerId) {
        (req as any).customerId = (user as any).id || (user as any).customerId;
      }
      if ((user as any).adminId) {
        (req as any).adminId = (user as any).adminId;
      }
    }
    next();
  });
}

/**
 * Helper to generate signed JWT tokens
 */
export function generateToken(payload: object, expiresIn: jwt.SignOptions['expiresIn'] = '24h'): string {
  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256', expiresIn });
}
