import { Schema, model, Document, Types } from 'mongoose';

export type MemberStatus = 'active' | 'inactive' | 'suspended';

export interface IMember extends Document {
  createdAt: Date;
  updatedAt: Date;
  memberId: string;
  user?: Types.ObjectId;
  fullName: string;
  profilePicture?: string;
  email: string;
  phone: string;
  gender?: 'male' | 'female' | 'other';
  dateOfBirth?: Date;
  address?: string;
  emergencyContact?: { name?: string; phone?: string; relationship?: string };
  registrationDate: Date;
  assignedTrainer?: Types.ObjectId;
  status: MemberStatus;
  faceEnrolled: boolean;
  notes?: string;
}

const memberSchema = new Schema<IMember>(
  {
    memberId: { type: String, unique: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    fullName: { type: String, required: true, trim: true, index: true },
    profilePicture: { type: String },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    phone: { type: String, required: true, trim: true },
    gender: { type: String, enum: ['male', 'female', 'other'] },
    dateOfBirth: { type: Date },
    address: { type: String },
    emergencyContact: { name: String, phone: String, relationship: String },
    registrationDate: { type: Date, default: Date.now },
    assignedTrainer: { type: Schema.Types.ObjectId, ref: 'Trainer', index: true },
    status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active', index: true },
    faceEnrolled: { type: Boolean, default: false },
    notes: { type: String },
  },
  { timestamps: true }
);

memberSchema.pre('validate', async function (next) {
  if (!this.memberId) {
    const count = await model('Member').countDocuments();
    this.memberId = `GYM-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

export const Member = model<IMember>('Member', memberSchema);
