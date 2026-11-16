import { Schema, model, Document, Types } from 'mongoose';

/**
 * Stores ONE averaged face descriptor per member, AES-256-GCM encrypted at rest.
 * The encrypted payload and descriptor are never exposed through the API.
 */
export interface IBiometricProfile extends Document {
  createdAt: Date;
  updatedAt: Date;
  member: Types.ObjectId;
  encryptedDescriptor: string;
  samplesCount: number;
  consentGiven: boolean;
  consentAt?: Date;
  status: 'active' | 'deleted';
  enrolledBy?: Types.ObjectId;
}

const biometricSchema = new Schema<IBiometricProfile>(
  {
    member: { type: Schema.Types.ObjectId, ref: 'Member', required: true, unique: true, index: true },
    encryptedDescriptor: { type: String, required: true, select: false },
    samplesCount: { type: Number, default: 0 },
    consentGiven: { type: Boolean, default: false },
    consentAt: { type: Date },
    status: { type: String, enum: ['active', 'deleted'], default: 'active' },
    enrolledBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

biometricSchema.set('toJSON', {
  transform: (_doc, ret) => {
    const r = ret as unknown as Record<string, unknown>;
    delete r.encryptedDescriptor;
    return ret;
  },
});

export const BiometricProfile = model<IBiometricProfile>('BiometricProfile', biometricSchema);
