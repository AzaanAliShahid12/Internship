import { Request, Response } from 'express';
import { z } from 'zod';
import { Trainer } from '../models/Trainer';
import { Member } from '../models/Member';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest, notFound } from '../utils/ApiError';
import { pageParams, pageResult } from '../utils/pagination';
import { writeAudit } from '../utils/audit';
import { isAdmin } from '../middleware/auth';

export const trainerSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(5),
  specialization: z.string().min(2),
  experienceYears: z.coerce.number().min(0).optional(),
  salary: z.coerce.number().min(0).optional(),
  availability: z.string().optional(),
  user: z.string().optional().nullable(),
});

function present(t: InstanceType<typeof Trainer>, includeSalary: boolean) {
  const o = t.toJSON() as Record<string, unknown>;
  if (!includeSalary) delete o.salary;
  return o;
}

export const listTrainers = asyncHandler(async (req: Request, res: Response) => {
  const p = pageParams(req);
  const filter: Record<string, unknown> = {};
  if (req.query.search) {
    const rx = new RegExp(String(req.query.search), 'i');
    filter.$or = [{ fullName: rx }, { specialization: rx }, { email: rx }];
  }
  if (req.query.active !== undefined) filter.isActive = req.query.active === 'true';
  const includeSalary = isAdmin(req.user!.role);
  const query = Trainer.find(filter).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit);
  if (includeSalary) query.select('+salary');
  const [docs, total] = await Promise.all([query, Trainer.countDocuments(filter)]);
  const items = await Promise.all(docs.map(async t => {
    const assignedCount = await Member.countDocuments({ assignedTrainer: t._id, status: 'active' });
    return { ...present(t, includeSalary), assignedCount };
  }));
  res.json({ success: true, data: pageResult(items, total, p) });
});

export const getTrainer = asyncHandler(async (req: Request, res: Response) => {
  const query = Trainer.findById(req.params.id);
  if (isAdmin(req.user!.role)) query.select('+salary');
  const trainer = await query;
  if (!trainer) throw notFound('Trainer not found');
  const members = await Member.find({ assignedTrainer: trainer._id }).select('fullName memberId email phone status');
  res.json({ success: true, data: { ...present(trainer, isAdmin(req.user!.role)), assignedMembers: members } });
});

export const createTrainer = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as z.infer<typeof trainerSchema>;
  if (await Trainer.findOne({ email: body.email.toLowerCase() })) throw badRequest('A trainer with this email already exists');
  const data: Record<string, unknown> = { ...body, email: body.email.toLowerCase(), user: body.user || undefined };
  if (req.file) data.profileImage = `/uploads/${req.file.filename}`;
  const trainer = await Trainer.create(data);
  await writeAudit({ actorId: req.user!.id, action: 'trainer.create', entity: 'Trainer', entityId: String(trainer._id), ip: req.ip });
  res.status(201).json({ success: true, data: present(trainer, isAdmin(req.user!.role)) });
});

export const updateTrainer = asyncHandler(async (req: Request, res: Response) => {
  const trainer = await Trainer.findById(req.params.id);
  if (!trainer) throw notFound('Trainer not found');
  const body = req.body as Partial<z.infer<typeof trainerSchema>>;
  Object.assign(trainer, { ...body, user: body.user || trainer.user });
  if (req.file) trainer.profileImage = `/uploads/${req.file.filename}`;
  await trainer.save();
  await writeAudit({ actorId: req.user!.id, action: 'trainer.update', entity: 'Trainer', entityId: String(trainer._id), ip: req.ip });
  res.json({ success: true, data: present(trainer, isAdmin(req.user!.role)) });
});

export const deleteTrainer = asyncHandler(async (req: Request, res: Response) => {
  const trainer = await Trainer.findById(req.params.id);
  if (!trainer) throw notFound('Trainer not found');
  trainer.isActive = false;
  await trainer.save();
  await Member.updateMany({ assignedTrainer: trainer._id }, { $unset: { assignedTrainer: 1 } });
  await writeAudit({ actorId: req.user!.id, action: 'trainer.deactivate', entity: 'Trainer', entityId: String(trainer._id), ip: req.ip });
  res.json({ success: true, message: 'Trainer deactivated and members unassigned' });
});

export const assignMemberSchema = z.object({ memberId: z.string().min(1) });

export const assignMemberToTrainer = asyncHandler(async (req: Request, res: Response) => {
  const trainer = await Trainer.findById(req.params.id);
  if (!trainer) throw notFound('Trainer not found');
  const member = await Member.findById((req.body as z.infer<typeof assignMemberSchema>).memberId);
  if (!member) throw notFound('Member not found');
  member.assignedTrainer = trainer._id as never;
  await member.save();
  res.json({ success: true, message: `${member.fullName} assigned to ${trainer.fullName}` });
});

/** Trainer portal: my assigned members. */
export const myMembers = asyncHandler(async (req: Request, res: Response) => {
  const trainer = await Trainer.findOne({ user: req.user!.id });
  if (!trainer) throw notFound('No trainer profile is linked to this account');
  const members = await Member.find({ assignedTrainer: trainer._id }).sort({ fullName: 1 });
  res.json({ success: true, data: { trainer, members } });
});
