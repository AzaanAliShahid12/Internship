import { Schema, model, Document, Types } from 'mongoose';

export type MembershipStatus = 'active' | 'expired' | 'suspended' | 'cancelled';

export interface IMembership extends Document {
  createdAt: Date;
  updatedAt: Date;
  member: Types.ObjectId;
  plan: Types.ObjectId;
  startDate: Date;
  expiryDate: Date;
  status: MembershipStatus;
  pricePaid: number;
  isCurrent: boolean;
}

const membershipSchema = new Schema<IMembership>(
  {
    member: { type: Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
    plan: { type: Schema.Types.ObjectId, ref: 'MembershipPlan', required: true },
    startDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true, index: true },
    status: { type: String, enum: ['active', 'expired', 'suspended', 'cancelled'], default: 'active', index: true },
    pricePaid: { type: Number, required: true, min: 0 },
    isCurrent: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

membershipSchema.index({ member: 1, isCurrent: 1 });

export const Membership = model<IMembership>('Membership', membershipSchema);

/** Effective status: a stored-active membership past its expiry date counts as expired. */
export function effectiveStatus(m: { status: MembershipStatus; expiryDate: Date }): MembershipStatus {
  if (m.status === 'active' && m.expiryDate.getTime() < Date.now()) return 'expired';
  return m.status;
}
