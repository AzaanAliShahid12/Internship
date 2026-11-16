import { Request, Response } from 'express';
import { z } from 'zod';
import { MembershipPlan, PLAN_TYPES } from '../models/MembershipPlan';
import { Membership } from '../models/Membership';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest, notFound } from '../utils/ApiError';
import { writeAudit } from '../utils/audit';

export const planSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  planType: z.enum(PLAN_TYPES),
  durationDays: z.number().int().min(1),
  price: z.number().min(0),
  features: z.array(z.string()).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export const listPlans = asyncHandler(async (req: Request, res: Response) => {
  const filter: Record<string, unknown> = {};
  if (req.query.status) filter.status = req.query.status;
  const plans = await MembershipPlan.find(filter).sort({ price: 1 });
  res.json({ success: true, data: plans });
});

export const getPlan = asyncHandler(async (req: Request, res: Response) => {
  const plan = await MembershipPlan.findById(req.params.id);
  if (!plan) throw notFound('Plan not found');
  res.json({ success: true, data: plan });
});

export const createPlan = asyncHandler(async (req: Request, res: Response) => {
  const plan = await MembershipPlan.create(req.body);
  await writeAudit({ actorId: req.user!.id, action: 'plan.create', entity: 'MembershipPlan', entityId: String(plan._id), ip: req.ip });
  res.status(201).json({ success: true, data: plan });
});

export const updatePlan = asyncHandler(async (req: Request, res: Response) => {
  const plan = await MembershipPlan.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!plan) throw notFound('Plan not found');
  await writeAudit({ actorId: req.user!.id, action: 'plan.update', entity: 'MembershipPlan', entityId: String(plan._id), ip: req.ip });
  res.json({ success: true, data: plan });
});

export const deletePlan = asyncHandler(async (req: Request, res: Response) => {
  const inUse = await Membership.countDocuments({ plan: req.params.id, isCurrent: true });
  if (inUse > 0) throw badRequest('This plan is assigned to active members and cannot be deleted. Deactivate it instead.');
  const plan = await MembershipPlan.findByIdAndDelete(req.params.id);
  if (!plan) throw notFound('Plan not found');
  await writeAudit({ actorId: req.user!.id, action: 'plan.delete', entity: 'MembershipPlan', entityId: req.params.id, ip: req.ip });
  res.json({ success: true, message: 'Plan deleted' });
});
