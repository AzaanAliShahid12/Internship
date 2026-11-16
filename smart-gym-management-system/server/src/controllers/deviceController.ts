import { Request, Response } from 'express';
import { z } from 'zod';
import { Device } from '../models/Device';
import { asyncHandler } from '../utils/asyncHandler';
import { notFound } from '../utils/ApiError';
import { writeAudit } from '../utils/audit';

export const deviceSchema = z.object({
  name: z.string().min(2),
  location: z.string().optional(),
  type: z.enum(['qr_scanner', 'face_terminal', 'reception_desk', 'other']).optional(),
});

export const listDevices = asyncHandler(async (_req: Request, res: Response) => {
  const devices = await Device.find().sort({ createdAt: -1 });
  res.json({ success: true, data: devices });
});

export const createDevice = asyncHandler(async (req: Request, res: Response) => {
  const device = await Device.create(req.body);
  await writeAudit({ actorId: req.user!.id, action: 'device.create', entity: 'Device', entityId: String(device._id), ip: req.ip });
  res.status(201).json({ success: true, data: device });
});

export const updateDevice = asyncHandler(async (req: Request, res: Response) => {
  const device = await Device.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!device) throw notFound('Device not found');
  res.json({ success: true, data: device });
});

export const deleteDevice = asyncHandler(async (req: Request, res: Response) => {
  const device = await Device.findByIdAndDelete(req.params.id);
  if (!device) throw notFound('Device not found');
  res.json({ success: true, message: 'Device removed' });
});
