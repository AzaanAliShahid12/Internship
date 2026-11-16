import { Request, Response } from 'express';
import { Notification } from '../models/Notification';
import { Member } from '../models/Member';
import { asyncHandler } from '../utils/asyncHandler';
import { notFound, forbidden } from '../utils/ApiError';
import { pageParams, pageResult } from '../utils/pagination';
import { isStaff } from '../middleware/auth';

function visibilityFilter(req: Request) {
  // Staff see staff-audience + own; members see notifications for their member record + own user.
  if (isStaff(req.user!.role)) {
    return { $or: [{ audience: 'staff' }, { recipient: req.user!.id }] };
  }
  return { $or: [{ recipient: req.user!.id }, { audience: 'member' }] };
}

export const listNotifications = asyncHandler(async (req: Request, res: Response) => {
  const p = pageParams(req);
  const filter: Record<string, unknown> = visibilityFilter(req);
  if (req.query.unread === 'true') filter.isRead = false;
  let finalFilter: Record<string, unknown> = filter;
  if (req.user!.role === 'member') {
    const member = await Member.findOne({ user: req.user!.id }).select('_id');
    finalFilter = { $or: [{ recipient: req.user!.id }, ...(member ? [{ member: member._id }] : [])] };
  }
  const [items, total, unread] = await Promise.all([
    Notification.find(finalFilter).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit),
    Notification.countDocuments(finalFilter),
    Notification.countDocuments({ ...finalFilter, isRead: false }),
  ]);
  res.json({ success: true, data: { ...pageResult(items, total, p), unread } });
});

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  const notification = await Notification.findById(req.params.id);
  if (!notification) throw notFound('Notification not found');
  if (notification.recipient && String(notification.recipient) !== req.user!.id && !isStaff(req.user!.role)) {
    throw forbidden('Not your notification');
  }
  notification.isRead = true;
  await notification.save();
  res.json({ success: true, data: notification });
});

export const markAllRead = asyncHandler(async (req: Request, res: Response) => {
  const filter = req.user!.role === 'member'
    ? { recipient: req.user!.id, isRead: false }
    : { audience: 'staff', isRead: false };
  await Notification.updateMany(filter, { isRead: true });
  res.json({ success: true, message: 'All notifications marked as read' });
});
