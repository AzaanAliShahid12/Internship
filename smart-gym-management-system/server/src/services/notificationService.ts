import { Notification, NotificationType } from '../models/Notification';
import { emitToStaff, emitToUser } from '../sockets/socket';
import { Types } from 'mongoose';

export interface NotifyParams {
  type: NotificationType;
  title: string;
  message: string;
  audience?: 'staff' | 'member' | 'user';
  recipientUserId?: string;
  memberId?: string;
}

export async function notify(params: NotifyParams) {
  const doc = await Notification.create({
    type: params.type,
    title: params.title,
    message: params.message,
    audience: params.audience ?? 'staff',
    recipient: params.recipientUserId ? new Types.ObjectId(params.recipientUserId) : undefined,
    member: params.memberId ? new Types.ObjectId(params.memberId) : undefined,
  });
  const payload = doc.toJSON();
  if (params.recipientUserId) emitToUser(params.recipientUserId, 'notification:new', payload);
  if ((params.audience ?? 'staff') === 'staff') emitToStaff('notification:new', payload);
  return doc;
}
