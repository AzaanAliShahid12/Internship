import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: Error & { statusCode?: number; code?: number }, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ success: false, message: err.message });
  }
  if ((err as { code?: number }).code === 11000) {
    return res.status(409).json({ success: false, message: 'A record with this value already exists' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Token expired' });
  }
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
  console.error('[error]', err);
  return res.status(500).json({ success: false, message: 'Internal server error' });
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ success: false, message: 'Route not found' });
}
