import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { Member } from '../models/Member';
import { Trainer } from '../models/Trainer';
import { Membership } from '../models/Membership';
import { Attendance, todayStr } from '../models/Attendance';
import { Payment } from '../models/Payment';
import { currentOccupancy } from '../services/attendanceService';

function monthStart(d = new Date()) { return new Date(d.getFullYear(), d.getMonth(), 1); }

export const dashboardStats = asyncHandler(async (_req: Request, res: Response) => {
  const now = new Date();
  const in7Days = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  const startOfMonth = monthStart(now);

  const [
    totalMembers, activeMembers, expiredMemberships, expiringSoon, todaysCheckIns,
    occupancy, totalTrainers, monthlyRevenueAgg, pendingPayments, newMembers,
    recentRegistrations, recentCheckIns, recentRejected, recentRenewals,
  ] = await Promise.all([
    Member.countDocuments(),
    Member.countDocuments({ status: 'active' }),
    Membership.countDocuments({ isCurrent: true, $or: [{ status: 'expired' }, { status: 'active', expiryDate: { $lt: now } }] }),
    Membership.countDocuments({ isCurrent: true, status: 'active', expiryDate: { $gte: now, $lte: in7Days } }),
    Attendance.countDocuments({ date: todayStr(), verificationResult: 'success' }),
    currentOccupancy(),
    Trainer.countDocuments({ isActive: true }),
    Payment.aggregate([
      { $match: { status: 'completed', paidAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: { $subtract: ['$amount', '$discount'] } } } },
    ]),
    Payment.countDocuments({ status: 'pending' }),
    Member.countDocuments({ createdAt: { $gte: startOfMonth } }),
    Member.find().sort({ createdAt: -1 }).limit(5).select('fullName memberId createdAt profilePicture'),
    Attendance.find({ verificationResult: 'success' }).populate('member', 'fullName memberId').sort({ checkInAt: -1 }).limit(5),
    Attendance.find({ verificationResult: 'rejected' }).populate('member', 'fullName memberId').sort({ checkInAt: -1 }).limit(5),
    Membership.find({ isCurrent: true }).populate('member', 'fullName memberId').populate('plan', 'name').sort({ updatedAt: -1 }).limit(5),
  ]);

  res.json({
    success: true,
    data: {
      totalMembers, activeMembers, expiredMemberships, expiringSoon,
      todaysCheckIns, currentOccupancy: occupancy, totalTrainers,
      monthlyRevenue: monthlyRevenueAgg[0]?.total ?? 0,
      pendingPayments, newMembersThisMonth: newMembers,
      recentActivity: {
        registrations: recentRegistrations,
        checkIns: recentCheckIns,
        rejected: recentRejected,
        renewals: recentRenewals,
      },
    },
  });
});

/** Attendance counts grouped by day for the last N days (default 30). */
export const dashboardAttendance = asyncHandler(async (req: Request, res: Response) => {
  const days = Math.min(90, Math.max(1, Number(req.query.days ?? 30) || 30));
  const since = new Date(Date.now() - (days - 1) * 24 * 3600 * 1000);
  since.setHours(0, 0, 0, 0);
  const rows = await Attendance.aggregate([
    { $match: { verificationResult: 'success', checkInAt: { $gte: since } } },
    { $group: { _id: '$date', count: { $sum: 1 }, qr: { $sum: { $cond: [{ $eq: ['$method', 'QR'] }, 1, 0] } }, face: { $sum: { $cond: [{ $eq: ['$method', 'FACE'] }, 1, 0] } }, manual: { $sum: { $cond: [{ $eq: ['$method', 'MANUAL'] }, 1, 0] } } } },
    { $sort: { _id: 1 } },
  ]);
  const byDate = new Map(rows.map(r => [r._id as string, r]));
  const series: { date: string; count: number; qr: number; face: number; manual: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since.getTime() + i * 24 * 3600 * 1000);
    const key = d.toISOString().slice(0, 10);
    const r = byDate.get(key);
    series.push({ date: key, count: r?.count ?? 0, qr: r?.qr ?? 0, face: r?.face ?? 0, manual: r?.manual ?? 0 });
  }
  res.json({ success: true, data: series });
});

/** Revenue grouped by month for the last N months (default 6) + membership distribution. */
export const dashboardRevenue = asyncHandler(async (req: Request, res: Response) => {
  const months = Math.min(24, Math.max(1, Number(req.query.months ?? 6) || 6));
  const since = monthStart(new Date());
  since.setMonth(since.getMonth() - (months - 1));
  const [revenueRows, distribution] = await Promise.all([
    Payment.aggregate([
      { $match: { status: 'completed', paidAt: { $gte: since } } },
      { $group: { _id: { y: { $year: '$paidAt' }, m: { $month: '$paidAt' } }, total: { $sum: { $subtract: ['$amount', '$discount'] } }, count: { $sum: 1 } } },
      { $sort: { '_id.y': 1, '_id.m': 1 } },
    ]),
    Membership.aggregate([
      { $match: { isCurrent: true } },
      { $lookup: { from: 'membershipplans', localField: 'plan', foreignField: '_id', as: 'planDoc' } },
      { $unwind: '$planDoc' },
      { $group: { _id: '$planDoc.name', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
  ]);
  const revenue = revenueRows.map(r => ({
    month: `${r._id.y}-${String(r._id.m).padStart(2, '0')}`,
    total: r.total, count: r.count,
  }));
  res.json({ success: true, data: { revenue, membershipDistribution: distribution.map(d => ({ plan: d._id, count: d.count })) } });
});
