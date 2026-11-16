import { Request, Response } from 'express';
import { z } from 'zod';
import { Attendance, todayStr } from '../models/Attendance';
import { Member } from '../models/Member';
import { asyncHandler } from '../utils/asyncHandler';
import { notFound } from '../utils/ApiError';
import { pageParams, pageResult } from '../utils/pagination';
import { performCheckIn, performCheckOut, currentOccupancy } from '../services/attendanceService';
import { toCsv } from '../utils/csv';

export const manualCheckInSchema = z.object({
  memberId: z.string().min(1),
  deviceId: z.string().optional(),
});

/** Manual check-in by receptionist lookup (member ID / database id). */
export const manualCheckIn = asyncHandler(async (req: Request, res: Response) => {
  const { memberId, deviceId } = req.body as z.infer<typeof manualCheckInSchema>;
  const member = (await Member.findById(memberId).catch(() => null)) ?? (await Member.findOne({ memberId }));
  if (!member) throw notFound('Member not found');
  const outcome = await performCheckIn({ member, method: 'MANUAL', deviceId });
  if (!outcome.success) return res.json({ success: true, data: { allowed: false, reason: outcome.reason } });
  res.json({ success: true, data: { allowed: true, checkInAt: outcome.attendance?.checkInAt, member: { memberId: member.memberId, fullName: member.fullName } } });
});

export const checkOutSchema = z.object({ memberId: z.string().min(1) });

export const checkOut = asyncHandler(async (req: Request, res: Response) => {
  const { memberId } = req.body as z.infer<typeof checkOutSchema>;
  const member = (await Member.findById(memberId).catch(() => null)) ?? (await Member.findOne({ memberId }));
  if (!member) throw notFound('Member not found');
  const attendance = await performCheckOut(String(member._id));
  res.json({ success: true, data: attendance });
});

export const listAttendance = asyncHandler(async (req: Request, res: Response) => {
  const p = pageParams(req);
  const filter: Record<string, unknown> = {};
  if (req.query.date) filter.date = req.query.date;
  if (req.query.from || req.query.to) {
    filter.checkInAt = {};
    if (req.query.from) (filter.checkInAt as Record<string, unknown>).$gte = new Date(String(req.query.from));
    if (req.query.to) (filter.checkInAt as Record<string, unknown>).$lte = new Date(String(req.query.to));
  }
  if (req.query.method) filter.method = req.query.method;
  if (req.query.result) filter.verificationResult = req.query.result;
  if (req.query.member) filter.member = req.query.member;
  if (req.query.search) {
    const members = await Member.find({ fullName: new RegExp(String(req.query.search), 'i') }).select('_id');
    filter.member = { $in: members.map(m => m._id) };
  }
  const [items, total] = await Promise.all([
    Attendance.find(filter).populate('member', 'fullName memberId profilePicture').sort({ checkInAt: -1 }).skip(p.skip).limit(p.limit),
    Attendance.countDocuments(filter),
  ]);
  res.json({ success: true, data: pageResult(items, total, p) });
});

export const todayAttendance = asyncHandler(async (req: Request, res: Response) => {
  const p = pageParams(req);
  const filter = { date: todayStr(), verificationResult: 'success' as const };
  const [items, total, occupancy] = await Promise.all([
    Attendance.find(filter).populate('member', 'fullName memberId profilePicture').sort({ checkInAt: -1 }).skip(p.skip).limit(p.limit),
    Attendance.countDocuments(filter),
    currentOccupancy(),
  ]);
  const rejectedToday = await Attendance.countDocuments({ date: todayStr(), verificationResult: 'rejected' });
  res.json({ success: true, data: { ...pageResult(items, total, p), occupancy, rejectedToday } });
});

export const memberAttendanceList = asyncHandler(async (req: Request, res: Response) => {
  const p = pageParams(req);
  const filter = { member: req.params.memberId };
  const [items, total] = await Promise.all([
    Attendance.find(filter).sort({ checkInAt: -1 }).skip(p.skip).limit(p.limit),
    Attendance.countDocuments(filter),
  ]);
  res.json({ success: true, data: pageResult(items, total, p) });
});

export const exportAttendanceCsv = asyncHandler(async (req: Request, res: Response) => {
  const filter: Record<string, unknown> = {};
  if (req.query.from || req.query.to) {
    filter.checkInAt = {};
    if (req.query.from) (filter.checkInAt as Record<string, unknown>).$gte = new Date(String(req.query.from));
    if (req.query.to) (filter.checkInAt as Record<string, unknown>).$lte = new Date(String(req.query.to));
  }
  if (req.query.method) filter.method = req.query.method;
  const rows = await Attendance.find(filter).populate('member', 'fullName memberId').sort({ checkInAt: -1 }).limit(10000);
  const csv = toCsv(rows.map(r => {
    const m = r.member as unknown as { fullName?: string; memberId?: string };
    return {
      memberId: m?.memberId ?? '', name: m?.fullName ?? '', method: r.method,
      result: r.verificationResult, reason: r.rejectionReason ?? '',
      checkIn: r.checkInAt.toISOString(), checkOut: r.checkOutAt ? r.checkOutAt.toISOString() : '',
    };
  }), [
    { key: 'memberId', label: 'Member ID' }, { key: 'name', label: 'Name' },
    { key: 'method', label: 'Method' }, { key: 'result', label: 'Result' },
    { key: 'reason', label: 'Rejection Reason' }, { key: 'checkIn', label: 'Check-In' },
    { key: 'checkOut', label: 'Check-Out' },
  ]);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="attendance.csv"');
  res.send(csv);
});

export const occupancy = asyncHandler(async (_req: Request, res: Response) => {
  const inside = await Attendance.find({ status: 'checked_in', verificationResult: 'success' })
    .populate('member', 'fullName memberId profilePicture').sort({ checkInAt: 1 });
  res.json({ success: true, data: { count: inside.length, members: inside } });
});
