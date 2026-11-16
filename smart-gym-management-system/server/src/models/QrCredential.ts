import { Schema, model, Document, Types } from 'mongoose';

export interface IQrCredential extends Document {
  createdAt: Date;
  updatedAt: Date;
  member: Types.ObjectId;
  tokenHash: string;
  /** AES-256-GCM encrypted raw token, so the member portal can re-render the QR image. Never returned by the API. */
  encryptedToken: string;
  status: 'active' | 'revoked';
  revokedAt?: Date;
  lastUsedAt?: Date;
}

const qrSchema = new Schema<IQrCredential>(
  {
    member: { type: Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true, select: false },
    encryptedToken: { type: String, required: true, select: false },
    status: { type: String, enum: ['active', 'revoked'], default: 'active', index: true },
    revokedAt: { type: Date },
    lastUsedAt: { type: Date },
  },
  { timestamps: true }
);

export const QrCredential = model<IQrCredential>('QrCredential', qrSchema);
