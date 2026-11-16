import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { AuditLog } from '../models/AuditLog';
import { pageParams, pageResult } from '../utils/pagination';

export const listAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const p = pageParams(req);
  const filter: Record<string, unknown> = {};
  if (req.query.entity) filter.entity = req.query.entity;
  if (req.query.action) filter.action = new RegExp(String(req.query.action), 'i');
  const [items, total] = await Promise.all([
    AuditLog.find(filter).populate('actor', 'name email role').sort({ createdAt: -1 }).skip(p.skip).limit(p.limit),
    AuditLog.countDocuments(filter),
  ]);
  res.json({ success: true, data: pageResult(items, total, p) });
});
