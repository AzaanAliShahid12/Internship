import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { badRequest } from '../utils/ApiError';

export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const first = result.error.issues[0];
      return next(badRequest(`${first.path.join('.') || 'input'}: ${first.message}`));
    }
    if (source === 'body') req.body = result.data;
    next();
  };
}
