import { Schema, model, Document, Types } from 'mongoose';

export interface ITrainer extends Document {
  createdAt: Date;
  updatedAt: Date;
  trainerId: string;
  user?: Types.ObjectId;
  fullName: string;
  email: string;
  phone: string;
  specialization: string;
  experienceYears: number;
  salary?: number;
  profileImage?: string;
  availability?: string;
  isActive: boolean;
}

const trainerSchema = new Schema<ITrainer>(
  {
    trainerId: { type: String, unique: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    fullName: { type: String, required: true, trim: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true },
    specialization: { type: String, required: true },
    experienceYears: { type: Number, default: 0, min: 0 },
    salary: { type: Number, min: 0, select: false },
    profileImage: { type: String },
    availability: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

trainerSchema.pre('validate', async function (next) {
  if (!this.trainerId) {
    const count = await model('Trainer').countDocuments();
    this.trainerId = `TRN-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

export const Trainer = model<ITrainer>('Trainer', trainerSchema);
