import { Request, Response } from 'express';
import { z } from 'zod';
import { Membership } from '../models/Membership';
import { MembershipPlan } from '../models/MembershipPlan';
import { Member } from '../models/Member';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest, notFound } from '../utils/ApiError';
import { pageParams, pageResult } from '../utils/pagination';
import { effectiveStatus } from '../models/Membership';
import { writeAudit } from '../utils/audit';
import { notify } from '../services/notificationService';

export const assignSchema = z.object({
  memberId: z.string().min(1),
  planId: z.string().min(1),
  startDate: z.string().optional(),
  pricePaid: z.number().min(0).optional(),
});

/** Assign (or change) a plan to a member: previous current membership is closed, a new one starts. */
export const assignMembership = asyncHandler(async (req: Request, res: Response) => {
  const { memberId, planId, startDate, pricePaid } = req.body as z.infer<typeof assignSchema>;
  const member = await Member.findById(memberId);
  if (!member) throw notFound('Member not found');
  const plan = await MembershipPlan.findById(planId);
  if (!plan) throw notFound('Plan not found');
  if (plan.status !== 'active') throw badRequest('This plan is not active');

  await Membership.updateMany({ member: member._id, isCurrent: true }, { isCurrent: false, status: 'cancelled' });
  const start = startDate ? new Date(startDate) : new Date();
  const expiry = new Date(start);
  expiry.setDate(expiry.getDate() + plan.durationDays);
  const membership = await Membership.create({
    member: member._id, plan: plan._id, startDate: start, expiryDate: expiry,
    pricePaid: pricePaid ?? plan.price, status: 'active', isCurrent: true,
  });
  await membership.populate('plan');
  await notify({ type: 'membership_renewed', title: 'Membership assigned', message: `${member.fullName} is now on the ${plan.name} plan until ${expiry.toISOString().slice(0, 10)}`, memberId: String(member._id) });
  await writeAudit({ actorId: req.user!.id, action: 'membership.assign', entity: 'Membership', entityId: String(membership._id), details: { memberId, planId }, ip: req.ip });
  res.status(201).json({ success: true, data: membership });
});

export const listMemberships = asyncHandler(async (req: Request, res: Response) => {
  const p = pageParams(req);
  const filter: Record<string, unknown> = { isCurrent: true };
  if (req.query.member) filter.member = req.query.member;
  if (req.query.plan) filter.plan = req.query.plan;
  const [docs, total] = await Promise.all([
    Membership.find(filter).populate('member', 'fullName memberId email').populate('plan', 'name price durationDays')
      .sort({ expiryDate: 1 }).skip(p.skip).limit(p.limit),
    Membership.countDocuments(filter),
  ]);
  const items = docs.map(d => { const o = d.toJSON() as Record<string, unknown>; o.status = effectiveStatus(d); return o; });
  const statusFilter = req.query.status ? String(req.query.status) : null;
  const filtered = statusFilter ? items.filter(i => i.status === statusFilter) : items;
  res.json({ success: true, data: pageResult(filtered, statusFilter ? filtered.length : total, p) });
});

export const updateMembershipSchema = z.object({
  status: z.enum(['active', 'suspended', 'cancelled']).optional(),
  expiryDate: z.string().optional(),
});

export const updateMembership = asyncHandler(async (req: Request, res: Response) => {
  const membership = await Membership.findById(req.params.id);
  if (!membership) throw notFound('Membership not found');
  const body = req.body as z.infer<typeof updateMembershipSchema>;
  if (body.status) membership.status = body.status;
  if (body.expiryDate) membership.expiryDate = new Date(body.expiryDate);
  await membership.save();
  await membership.populate('plan');
  res.json({ success: true, data: membership });
});

/** Renew: extend from the later of today or current expiry, using the same plan. */
export const renewMembership = asyncHandler(async (req: Request, res: Response) => {
  const membership = await Membership.findById(req.params.id).populate('plan');
  if (!membership) throw notFound('Membership not found');
  const plan = membership.plan as unknown as InstanceType<typeof MembershipPlan>;
  const base = membership.expiryDate > new Date() ? new Date(membership.expiryDate) : new Date();
  membership.expiryDate = new Date(base.setDate(base.getDate() + plan.durationDays));
  membership.status = 'active';
  membership.isCurrent = true;
  await membership.save();
  const member = await Member.findById(membership.member);
  await notify({ type: 'membership_renewed', title: 'Membership renewed', message: `${member?.fullName ?? 'Member'} renewed ${plan.name}; new expiry ${membership.expiryDate.toISOString().slice(0, 10)}`, memberId: String(membership.member) });
  await writeAudit({ actorId: req.user!.id, action: 'membership.renew', entity: 'Membership', entityId: String(membership._id), ip: req.ip });
  res.json({ success: true, data: membership });
});

/** Upcoming renewals: current memberships expiring within N days (default 7). */
export const upcomingRenewals = asyncHandler(async (req: Request, res: Response) => {
  const days = Math.min(90, Math.max(1, Number(req.query.days ?? 7) || 7));
  const until = new Date(Date.now() + days * 24 * 3600 * 1000);
  const docs = await Membership.find({ isCurrent: true, status: 'active', expiryDate: { $gte: new Date(), $lte: until } })
    .populate('member', 'fullName memberId email phone').populate('plan', 'name price').sort({ expiryDate: 1 });
  res.json({ success: true, data: docs });
});
