import { Request, Response } from 'express';
import { z } from 'zod';
import { User, hashPassword, ROLES } from '../models/User';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest, notFound, forbidden } from '../utils/ApiError';
import { pageParams, pageResult } from '../utils/pagination';
import { writeAudit } from '../utils/audit';

function pub(u: InstanceType<typeof User>) {
  return { id: String(u._id), name: u.name, email: u.email, role: u.role, isActive: u.isActive, lastLoginAt: u.lastLoginAt, createdAt: u.createdAt };
}

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const p = pageParams(req);
  const filter: Record<string, unknown> = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.search) filter.$or = [
    { name: new RegExp(String(req.query.search), 'i') },
    { email: new RegExp(String(req.query.search), 'i') },
  ];
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit),
    User.countDocuments(filter),
  ]);
  res.json({ success: true, data: pageResult(items.map(pub), total, p) });
});

export const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(ROLES),
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, role } = req.body as z.infer<typeof createUserSchema>;
  if (role === 'super_admin' && req.user!.role !== 'super_admin') {
    throw forbidden('Only a super admin can create another super admin');
  }
  if (await User.findOne({ email: email.toLowerCase() })) throw badRequest('Email already in use');
  const user = await User.create({ name, email: email.toLowerCase(), passwordHash: await hashPassword(password), role });
  await writeAudit({ actorId: req.user!.id, action: 'user.create', entity: 'User', entityId: String(user._id), details: { role }, ip: req.ip });
  res.status(201).json({ success: true, data: pub(user) });
});

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(ROLES).optional(),
  isActive: z.boolean().optional(),
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.params.id);
  if (!user) throw notFound('User not found');
  const body = req.body as z.infer<typeof updateUserSchema>;
  if (body.role === 'super_admin' && req.user!.role !== 'super_admin') throw forbidden('Only a super admin can assign the super admin role');
  Object.assign(user, body);
  await user.save();
  await writeAudit({ actorId: req.user!.id, action: 'user.update', entity: 'User', entityId: String(user._id), details: body, ip: req.ip });
  res.json({ success: true, data: pub(user) });
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.params.id);
  if (!user) throw notFound('User not found');
  if (String(user._id) === req.user!.id) throw badRequest('You cannot deactivate your own account');
  user.isActive = false;
  user.refreshTokens = [];
  await user.save();
  await writeAudit({ actorId: req.user!.id, action: 'user.deactivate', entity: 'User', entityId: String(user._id), ip: req.ip });
  res.json({ success: true, message: 'User deactivated' });
});
