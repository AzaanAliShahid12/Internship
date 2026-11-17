import { Types } from 'mongoose';
import { Member } from '../models/Member';
import { User } from '../models/User';

/**
 * Find-or-create the member profile linked to a member login account.
 *
 * Website sign-ups only create a login (User). The gym also needs a Member
 * record (member code, plan, QR, attendance) before the member portal can
 * show anything, so the profile is created automatically:
 * - if a profile is already linked to this login, it is returned as-is;
 * - if the front desk already created a member record with the same email
 *   (a walk-in member), that record is linked to this login instead of
 *   creating a duplicate;
 * - otherwise a fresh profile is created with no plan yet — the gym assigns
 *   a membership plan from the admin side.
 *
 * Returns null when the account is not a member account, or when the email
 * already belongs to a profile linked to a different login.
 */
export async function ensureMemberProfile(userId: string | Types.ObjectId, phone?: string) {
  const linked = await Member.findOne({ user: userId });
  if (linked) return linked;

  const user = await User.findById(userId);
  if (!user || user.role !== 'member') return null;

  try {
    return await Member.create({
      user: user._id,
      fullName: user.name,
      email: user.email,
      phone: phone?.trim() ? phone.trim() : 'Not provided',
      status: 'active',
      notes: 'Profile created automatically from website sign-up',
    });
  } catch (err) {
    if ((err as { code?: number }).code !== 11000) throw err;
    // A parallel request created it, or a member record with this email
    // already exists. Link the existing record if it is unclaimed.
    const byEmail = await Member.findOne({ email: user.email });
    if (byEmail && !byEmail.user) {
      byEmail.user = user._id;
      if (phone?.trim() && byEmail.phone === 'Not provided') byEmail.phone = phone.trim();
      await byEmail.save();
      return byEmail;
    }
    return Member.findOne({ user: userId });
  }
}
