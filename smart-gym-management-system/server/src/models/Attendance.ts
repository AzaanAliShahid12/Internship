import { Schema, model, Document, Types } from 'mongoose';

export type CheckInMethod = 'QR' | 'FACE' | 'MANUAL';
export type VerificationResult = 'success' | 'rejected';

export interface IAttendance extends Document {
  createdAt: Date;
  updatedAt: Date;
  member: Types.ObjectId;
  checkInAt: Date;
  checkOutAt?: Date;
  date: string; // YYYY-MM-DD of check-in, for fast daily queries
  method: CheckInMethod;
  status: 'checked_in' | 'checked_out';
  verificationResult: VerificationResult;
  rejectionReason?: string;
  entryDevice?: Types.ObjectId;
  faceDistance?: number;
}

const attendanceSchema = new Schema<IAttendance>(
  {
    member: { type: Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
    checkInAt: { type: Date, required: true, default: Date.now, index: true },
    checkOutAt: { type: Date },
    date: { type: String, required: true, index: true },
    method: { type: String, enum: ['QR', 'FACE', 'MANUAL'], required: true },
    status: { type: String, enum: ['checked_in', 'checked_out'], default: 'checked_in', index: true },
    verificationResult: { type: String, enum: ['success', 'rejected'], default: 'success', index: true },
    rejectionReason: { type: String },
    entryDevice: { type: Schema.Types.ObjectId, ref: 'Device' },
    faceDistance: { type: Number },
  },
  { timestamps: true }
);

attendanceSchema.index({ member: 1, status: 1, verificationResult: 1 });
attendanceSchema.index({ date: 1, verificationResult: 1 });

export const Attendance = model<IAttendance>('Attendance', attendanceSchema);

export function todayStr(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}
