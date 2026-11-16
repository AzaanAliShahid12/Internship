import { Schema, model, Document } from 'mongoose';

export const PLAN_TYPES = ['daily', 'weekly', 'monthly', 'quarterly', 'half_yearly', 'yearly', 'custom'] as const;
export type PlanType = (typeof PLAN_TYPES)[number];

export interface IMembershipPlan extends Document {
  createdAt: Date;
  updatedAt: Date;
  name: string;
  description?: string;
  planType: PlanType;
  durationDays: number;
  price: number;
  features: string[];
  status: 'active' | 'inactive';
}

const planSchema = new Schema<IMembershipPlan>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String },
    planType: { type: String, enum: PLAN_TYPES, required: true },
    durationDays: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    features: { type: [String], default: [] },
    status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
  },
  { timestamps: true }
);

export const MembershipPlan = model<IMembershipPlan>('MembershipPlan', planSchema);
