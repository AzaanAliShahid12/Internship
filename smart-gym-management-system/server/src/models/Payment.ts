import { Schema, model, Document, Types } from 'mongoose';

export const PAYMENT_METHODS = ['cash', 'bank_transfer', 'card', 'other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface IPayment extends Document {
  createdAt: Date;
  updatedAt: Date;
  paymentId: string;
  member: Types.ObjectId;
  membership?: Types.ObjectId;
  plan?: Types.ObjectId;
  amount: number;
  discount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionReference?: string;
  paidAt: Date;
  recordedBy?: Types.ObjectId;
  notes?: string;
}

const paymentSchema = new Schema<IPayment>(
  {
    paymentId: { type: String, unique: true, index: true },
    member: { type: Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
    membership: { type: Schema.Types.ObjectId, ref: 'Membership' },
    plan: { type: Schema.Types.ObjectId, ref: 'MembershipPlan' },
    amount: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    status: { type: String, enum: ['pending', 'completed', 'failed', 'refunded'], default: 'pending', index: true },
    transactionReference: { type: String },
    paidAt: { type: Date, default: Date.now, index: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String },
  },
  { timestamps: true }
);

paymentSchema.pre('validate', async function (next) {
  if (!this.paymentId) {
    const count = await model('Payment').countDocuments();
    this.paymentId = `PAY-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

export const Payment = model<IPayment>('Payment', paymentSchema);
