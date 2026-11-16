import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { Attendance } from '../models/Attendance';
import { Payment } from '../models/Payment';
import { Membership } from '../models/Membership';
import { Member } from '../models/Member';
import { effectiveStatus } from '../models/Membership';

function range(req: Request) {
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const to = req.query.to ? new Date(String(req.query.to)) : new Date();
  return { from, to };
}

export const attendanceReport = asyncHandler(async (req: Request, res: Response) => {
  const { from, to } = range(req);
  const rows = await Attendance.aggregate([
    { $match: { checkInAt: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: '$date',
        total: { $sum: 1 },
        success: { $sum: { $cond: [{ $eq: ['$verificationResult', 'success'] }, 1, 0] } },
        rejected: { $sum: { $cond: [{ $eq: ['$verificationResult', 'rejected'] }, 1, 0] } },
        qr: { $sum: { $cond: [{ $eq: ['$method', 'QR'] }, 1, 0] } },
        face: { $sum: { $cond: [{ $eq: ['$method', 'FACE'] }, 1, 0] } },
        manual: { $sum: { $cond: [{ $eq: ['$method', 'MANUAL'] }, 1, 0] } },
        checkOuts: { $sum: { $cond: [{ $ne: ['$checkOutAt', null] }, 1, 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  res.json({ success: true, data: rows.map(r => ({ date: r._id, ...r, _id: undefined })) });
});

export const revenueReport = asyncHandler(async (req: Request, res: Response) => {
  const { from, to } = range(req);
  const [byMethod, byStatus, totals] = await Promise.all([
    Payment.aggregate([
      { $match: { paidAt: { $gte: from, $lte: to } } },
      { $group: { _id: '$method', total: { $sum: { $subtract: ['$amount', '$discount'] } }, count: { $sum: 1 } } },
    ]),
    Payment.aggregate([
      { $match: { paidAt: { $gte: from, $lte: to } } },
      { $group: { _id: '$status', total: { $sum: { $subtract: ['$amount', '$discount'] } }, count: { $sum: 1 } } },
    ]),
    Payment.aggregate([
      { $match: { paidAt: { $gte: from, $lte: to }, status: 'completed' } },
      { $group: { _id: null, totalRevenue: { $sum: { $subtract: ['$amount', '$discount'] } }, transactions: { $sum: 1 } } },
    ]),
  ]);
  res.json({
    success: true,
    data: {
      totalRevenue: totals[0]?.totalRevenue ?? 0,
      completedTransactions: totals[0]?.transactions ?? 0,
      byMethod: byMethod.map(r => ({ method: r._id, total: r.total, count: r.count })),
      byStatus: byStatus.map(r => ({ status: r._id, total: r.total, count: r.count })),
    },
  });
});

export const membershipsReport = asyncHandler(async (_req: Request, res: Response) => {
  const all = await Membership.find({ isCurrent: true }).populate('plan', 'name');
  const counts = { active: 0, expired: 0, suspended: 0, cancelled: 0 };
  const byPlan = new Map<string, number>();
  for (const m of all) {
    const s = effectiveStatus(m);
    counts[s] += 1;
    const planName = (m.plan as unknown as { name?: string })?.name ?? 'Unknown';
    byPlan.set(planName, (byPlan.get(planName) ?? 0) + 1);
  }
  const totalMembers = await Member.countDocuments();
  res.json({
    success: true,
    data: {
      totalMembers,
      statusCounts: counts,
      byPlan: [...byPlan.entries()].map(([plan, count]) => ({ plan, count })),
    },
  });
});

export const rejectedReport = asyncHandler(async (req: Request, res: Response) => {
  const { from, to } = range(req);
  const rows = await Attendance.aggregate([
    { $match: { verificationResult: 'rejected', checkInAt: { $gte: from, $lte: to } } },
    { $group: { _id: '$rejectionReason', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  res.json({ success: true, data: rows.map(r => ({ reason: r._id, count: r.count })) });
});

export const occupancyReport = asyncHandler(async (req: Request, res: Response) => {
  const { from, to } = range(req);
  const rows = await Attendance.aggregate([
    { $match: { verificationResult: 'success', checkInAt: { $gte: from, $lte: to } } },
    { $group: { _id: '$date', checkIns: { $sum: 1 }, uniqueMembers: { $addToSet: '$member' } } },
    { $project: { date: '$_id', checkIns: 1, uniqueMembers: { $size: '$uniqueMembers' }, _id: 0 } },
    { $sort: { date: 1 } },
  ]);
  res.json({ success: true, data: rows });
});

export const registrationsReport = asyncHandler(async (req: Request, res: Response) => {
  const { from, to } = range(req);
  const rows = await Member.aggregate([
    { $match: { createdAt: { $gte: from, $lte: to } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  res.json({ success: true, data: rows.map(r => ({ date: r._id, count: r.count })) });
});
