import { Request, Response } from 'express';
import { z } from 'zod';
import { Member } from '../models/Member';
import { Attendance } from '../models/Attendance';
import { Payment } from '../models/Payment';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest, notFound, forbidden } from '../utils/ApiError';
import { pageParams, pageResult } from '../utils/pagination';
import { memberWithMembership } from '../services/membershipService';
import { ensureMemberProfile } from '../services/memberProfileService';
import { toCsv } from '../utils/csv';
import { writeAudit } from '../utils/audit';
import { notify } from '../services/notificationService';

export const memberSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(5),
  gender: z.enum(['male', 'female', 'other']).optional(),
  dateOfBirth: z.string().optional(),
  address: z.string().optional(),
  emergencyContact: z.object({ name: z.string().optional(), phone: z.string().optional(), relationship: z.string().optional() }).optional(),
  assignedTrainer: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  notes: z.string().optional(),
  user: z.string().optional().nullable(),
});

function buildMemberData(body: z.infer<typeof memberSchema>) {
  return {
    fullName: body.fullName,
    email: body.email.toLowerCase(),
    phone: body.phone,
    gender: body.gender,
    dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
    address: body.address,
    emergencyContact: body.emergencyContact,
    assignedTrainer: body.assignedTrainer || undefined,
    status: body.status,
    notes: body.notes,
    user: body.user || undefined,
  };
}

export const listMembers = asyncHandler(async (req: Request, res: Response) => {
  const p = pageParams(req);
  const filter: Record<string, unknown> = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.trainer) filter.assignedTrainer = req.query.trainer;
  if (req.query.search) {
    const rx = new RegExp(String(req.query.search), 'i');
    filter.$or = [{ fullName: rx }, { email: rx }, { phone: rx }, { memberId: rx }];
  }
  const [docs, total] = await Promise.all([
    Member.find(filter).populate('assignedTrainer', 'fullName trainerId').sort({ createdAt: -1 }).skip(p.skip).limit(p.limit),
    Member.countDocuments(filter),
  ]);
  const items = await Promise.all(docs.map(m => memberWithMembership(m)));
  // Optional plan filter applied after joining current membership.
  const planFilter = req.query.plan ? String(req.query.plan) : null;
  const filtered = planFilter ? items.filter(i => String((i.currentMembership as { plan?: unknown })?.plan ?? '') === planFilter || i.membershipPlan === planFilter) : items;
  res.json({ success: true, data: pageResult(filtered, planFilter ? filtered.length : total, p) });
});

export const getMember = asyncHandler(async (req: Request, res: Response) => {
  const member = await Member.findById(req.params.id).populate('assignedTrainer', 'fullName trainerId specialization');
  if (!member) throw notFound('Member not found');
  // A member-role user may only view their own profile.
  if (req.user!.role === 'member' && String(member.user ?? '') !== req.user!.id) throw forbidden('You can only view your own profile');
  res.json({ success: true, data: await memberWithMembership(member) });
});

export const createMember = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as z.infer<typeof memberSchema>;
  if (await Member.findOne({ email: body.email.toLowerCase() })) throw badRequest('A member with this email already exists');
  const data = buildMemberData(body);
  const createData = req.file ? { ...data, profilePicture: `/uploads/${req.file.filename}` } : data;
  const member = await Member.create(createData);
  await notify({ type: 'new_member', title: 'New member registered', message: `${member.fullName} (${member.memberId}) joined the gym`, memberId: String(member._id) });
  await writeAudit({ actorId: req.user!.id, action: 'member.create', entity: 'Member', entityId: String(member._id), ip: req.ip });
  res.status(201).json({ success: true, data: await memberWithMembership(member) });
});

export const updateMember = asyncHandler(async (req: Request, res: Response) => {
  const member = await Member.findById(req.params.id);
  if (!member) throw notFound('Member not found');
  const body = req.body as Partial<z.infer<typeof memberSchema>>;
  if (body.email && body.email.toLowerCase() !== member.email) {
    if (await Member.findOne({ email: body.email.toLowerCase() })) throw badRequest('A member with this email already exists');
  }
  Object.assign(member, buildMemberData({ ...member.toObject(), ...body } as z.infer<typeof memberSchema>));
  if (req.file) member.profilePicture = `/uploads/${req.file.filename}`;
  await member.save();
  await writeAudit({ actorId: req.user!.id, action: 'member.update', entity: 'Member', entityId: String(member._id), ip: req.ip });
  res.json({ success: true, data: await memberWithMembership(member) });
});

export const deleteMember = asyncHandler(async (req: Request, res: Response) => {
  const member = await Member.findById(req.params.id);
  if (!member) throw notFound('Member not found');
  member.status = 'inactive';
  await member.save();
  await writeAudit({ actorId: req.user!.id, action: 'member.deactivate', entity: 'Member', entityId: String(member._id), ip: req.ip });
  res.json({ success: true, message: 'Member deactivated' });
});

export const exportMembersCsv = asyncHandler(async (_req: Request, res: Response) => {
  const members = await Member.find().sort({ createdAt: -1 }).limit(5000);
  const rows = await Promise.all(members.map(async m => {
    const w = await memberWithMembership(m);
    return {
      memberId: m.memberId, fullName: m.fullName, email: m.email, phone: m.phone,
      status: m.status, plan: (w.membershipPlan as string) ?? '',
      expiry: w.membershipExpiryDate ? new Date(w.membershipExpiryDate as string).toISOString().slice(0, 10) : '',
      registered: m.registrationDate.toISOString().slice(0, 10),
    };
  }));
  const csv = toCsv(rows, [
    { key: 'memberId', label: 'Member ID' }, { key: 'fullName', label: 'Full Name' },
    { key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone' },
    { key: 'status', label: 'Status' }, { key: 'plan', label: 'Plan' },
    { key: 'expiry', label: 'Membership Expiry' }, { key: 'registered', label: 'Registered' },
  ]);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="members.csv"');
  res.send(csv);
});

export const memberAttendance = asyncHandler(async (req: Request, res: Response) => {
  const p = pageParams(req);
  const filter = { member: req.params.id };
  const [items, total] = await Promise.all([
    Attendance.find(filter).sort({ checkInAt: -1 }).skip(p.skip).limit(p.limit),
    Attendance.countDocuments(filter),
  ]);
  res.json({ success: true, data: pageResult(items, total, p) });
});

export const memberPayments = asyncHandler(async (req: Request, res: Response) => {
  const p = pageParams(req);
  const filter = { member: req.params.id };
  const [items, total] = await Promise.all([
    Payment.find(filter).populate('plan', 'name').sort({ paidAt: -1 }).skip(p.skip).limit(p.limit),
    Payment.countDocuments(filter),
  ]);
  res.json({ success: true, data: pageResult(items, total, p) });
});

/** Member-portal: resolve the member record linked to the logged-in user.
 *  Self-registered accounts get their profile created/linked on first use,
 *  so a website sign-up never lands on a dead end. */
export async function resolveOwnMember(req: Request) {
  const member = await ensureMemberProfile(req.user!.id);
  if (!member) throw notFound('No member profile is linked to this account');
  return member;
}

export const myProfile = asyncHandler(async (req: Request, res: Response) => {
  const member = await resolveOwnMember(req);
  res.json({ success: true, data: await memberWithMembership(member) });
});
