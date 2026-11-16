import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../utils/tokens';
import { unauthorized, forbidden } from '../utils/ApiError';
import { User, Role } from '../models/User';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: Role; email: string; name: string };
    }
  }
}

export async function protect(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) throw unauthorized('No access token provided');
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub).lean();
    if (!user || !user.isActive) throw unauthorized('User no longer active');
    req.user = { id: String(user._id), role: user.role, email: user.email, name: user.name };
    next();
  } catch (err) {
    next(err instanceof Error && err.name === 'JsonWebTokenError' ? unauthorized('Invalid token') : err);
  }
}

export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden('You do not have permission to perform this action'));
    next();
  };
}

export const isStaff = (role: Role) => ['super_admin', 'gym_admin', 'receptionist'].includes(role);
export const isAdmin = (role: Role) => ['super_admin', 'gym_admin'].includes(role);
