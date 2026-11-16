import { Schema, model, Document, Types } from 'mongoose';
import bcrypt from 'bcryptjs';

export const ROLES = ['super_admin', 'gym_admin', 'receptionist', 'trainer', 'member'] as const;
export type Role = (typeof ROLES)[number];

export interface IUser extends Document {
  createdAt: Date;
  updatedAt: Date;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  isActive: boolean;
  refreshTokens: { tokenHash: string; expiresAt: Date }[];
  passwordResetTokenHash?: string;
  passwordResetExpires?: Date;
  lastLoginAt?: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true, default: 'member', index: true },
    isActive: { type: Boolean, default: true },
    refreshTokens: [
      { tokenHash: { type: String, required: true }, expiresAt: { type: Date, required: true }, _id: false },
    ],
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

userSchema.methods.comparePassword = function (candidate: string) {
  return bcrypt.compare(candidate, this.passwordHash);
};

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export const User = model<IUser>('User', userSchema);
export type UserDoc = IUser & { _id: Types.ObjectId };
