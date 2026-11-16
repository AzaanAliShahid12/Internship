import { Schema, model, Document, Types } from 'mongoose';

export const NOTIFICATION_TYPES = [
  'membership_expiring',
  'membership_expired',
  'payment_received',
  'membership_renewed',
  'check_in_success',
  'check_in_rejected',
  'new_member',
  'general',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface INotification extends Document {
  createdAt: Date;
  updatedAt: Date;
  recipient?: Types.ObjectId; // specific user, when set
  audience: 'user' | 'staff' | 'member';
  member?: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
}

const notificationSchema = new Schema<INotification>(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    audience: { type: String, enum: ['user', 'staff', 'member'], default: 'staff', index: true },
    member: { type: Schema.Types.ObjectId, ref: 'Member' },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

export const Notification = model<INotification>('Notification', notificationSchema);
