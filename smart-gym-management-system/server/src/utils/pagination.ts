import { Request } from 'express';
export interface PageParams { page: number; limit: number; skip: number; }
export function pageParams(req: Request): PageParams {
  const page = Math.max(1, Number(req.query.page ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 10) || 10));
  return { page, limit, skip: (page - 1) * limit };
}
export function pageResult<T>(items: T[], total: number, p: PageParams) {
  return { items, total, page: p.page, limit: p.limit, totalPages: Math.max(1, Math.ceil(total / p.limit)) };
}
