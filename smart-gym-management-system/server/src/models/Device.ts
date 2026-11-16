import { Schema, model, Document } from 'mongoose';
import crypto from 'crypto';

export interface IDevice extends Document {
  createdAt: Date;
  updatedAt: Date;
  name: string;
  location?: string;
  type: 'qr_scanner' | 'face_terminal' | 'reception_desk' | 'other';
  deviceKey: string;
  isActive: boolean;
  lastSeenAt?: Date;
}

const deviceSchema = new Schema<IDevice>(
  {
    name: { type: String, required: true, trim: true },
    location: { type: String },
    type: { type: String, enum: ['qr_scanner', 'face_terminal', 'reception_desk', 'other'], default: 'qr_scanner' },
    deviceKey: { type: String, unique: true, index: true, default: () => crypto.randomBytes(16).toString('hex') },
    isActive: { type: Boolean, default: true },
    lastSeenAt: { type: Date },
  },
  { timestamps: true }
);

export const Device = model<IDevice>('Device', deviceSchema);
