import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { Attendance } from '../models/Attendance';
import { Payment } from '../models/Payment';
import { pageParams, pageResult } from '../utils/pagination';
import { resolveOwnMember } from './memberController';
import { getCurrentMembership } from '../services/membershipService';
import { effectiveStatus } from '../models/Membership';
import { notify } from '../services/notificationService';
import { User } from '../models/User';
import { z } from 'zod';
import { memberWithMembership } from '../services/membershipService';

export const updateMyProfileSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().min(5).optional(),
  address: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  dateOfBirth: z.string().optional(),
  emergencyContact: z.object({ name: z.string().optional(), phone: z.string().optional(), relationship: z.string().optional() }).optional(),
});

export const updateMyProfile = asyncHandler(async (req: Request, res: Response) => {
  const member = await resolveOwnMember(req);
  const body = req.body as z.infer<typeof updateMyProfileSchema>;
  if (body.name) await User.findByIdAndUpdate(req.user!.id, { name: body.name });
  if (body.phone) member.phone = body.phone;
  if (body.address !== undefined) member.address = body.address;
  if (body.gender) member.gender = body.gender;
  if (body.dateOfBirth) member.dateOfBirth = new Date(body.dateOfBirth);
  if (body.emergencyContact) member.emergencyContact = body.emergencyContact;
  if (req.file) member.profilePicture = `/uploads/${req.file.filename}`;
  await member.save();
  res.json({ success: true, data: await memberWithMembership(member) });
});

/** Member portal endpoints — everything is scoped to the logged-in member. */

export const myAttendance = asyncHandler(async (req: Request, res: Response) => {
  const member = await resolveOwnMember(req);
  const p = pageParams(req);
  const filter = { member: member._id, verificationResult: 'success' as const };
  const [items, total, totalVisits, thisMonth] = await Promise.all([
    Attendance.find(filter).sort({ checkInAt: -1 }).skip(p.skip).limit(p.limit),
    Attendance.countDocuments(filter),
    Attendance.countDocuments(filter),
    Attendance.countDocuments({ ...filter, checkInAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } }),
  ]);
  res.json({ success: true, data: { ...pageResult(items, total, p), stats: { totalVisits, thisMonth } } });
});

export const myPayments = asyncHandler(async (req: Request, res: Response) => {
  const member = await resolveOwnMember(req);
  const p = pageParams(req);
  const [items, total] = await Promise.all([
    Payment.find({ member: member._id }).populate('plan', 'name').sort({ paidAt: -1 }).skip(p.skip).limit(p.limit),
    Payment.countDocuments({ member: member._id }),
  ]);
  res.json({ success: true, data: pageResult(items, total, p) });
});

export const myMembership = asyncHandler(async (req: Request, res: Response) => {
  const member = await resolveOwnMember(req);
  const membership = await getCurrentMembership(String(member._id));
  if (!membership) return res.json({ success: true, data: null });
  const obj = membership.toJSON() as Record<string, unknown>;
  obj.status = effectiveStatus(membership);
  const remainingDays = Math.max(0, Math.ceil((membership.expiryDate.getTime() - Date.now()) / (24 * 3600 * 1000)));
  obj.remainingDays = remainingDays;
  res.json({ success: true, data: obj });
});

/** Member asks the front desk to renew — creates a staff notification. */
export const requestRenewal = asyncHandler(async (req: Request, res: Response) => {
  const member = await resolveOwnMember(req);
  await notify({
    type: 'membership_renewed',
    title: 'Renewal requested',
    message: `${member.fullName} (${member.memberId}) requested a membership renewal from the member portal`,
    memberId: String(member._id),
  });
  res.json({ success: true, message: 'Renewal request sent to the front desk' });
});
