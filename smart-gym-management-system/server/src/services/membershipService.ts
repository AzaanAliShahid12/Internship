import { Member, IMember } from '../models/Member';
import { Membership, IMembership, effectiveStatus } from '../models/Membership';

export interface Eligibility {
  allowed: boolean;
  reason?: string;
  membership?: IMembership;
}

/** The member's current membership (latest marked current), populated with its plan. */
export async function getCurrentMembership(memberId: string) {
  return Membership.findOne({ member: memberId, isCurrent: true }).populate('plan').sort({ createdAt: -1 });
}

/**
 * Central entry-eligibility rule used by QR, face and manual check-in:
 * member must exist, account must be active, and membership must be active and unexpired.
 */
export async function checkEligibility(member: IMember): Promise<Eligibility> {
  if (member.status === 'suspended') return { allowed: false, reason: 'Suspended account' };
  if (member.status === 'inactive') return { allowed: false, reason: 'Inactive account' };
  const membership = await getCurrentMembership(String(member._id));
  if (!membership) return { allowed: false, reason: 'No active membership' };
  const status = effectiveStatus(membership);
  if (status === 'expired') return { allowed: false, reason: 'Expired membership', membership };
  if (status === 'suspended') return { allowed: false, reason: 'Membership suspended', membership };
  if (status === 'cancelled') return { allowed: false, reason: 'Membership cancelled', membership };
  return { allowed: true, membership };
}

export async function memberWithMembership(member: IMember) {
  const membership = await getCurrentMembership(String(member._id));
  const obj = member.toJSON() as Record<string, unknown>;
  if (membership) {
    const m = membership.toJSON() as Record<string, unknown>;
    m.status = effectiveStatus(membership);
    obj.currentMembership = m;
    const plan = membership.plan as unknown as { name?: string } | undefined;
    obj.membershipPlan = plan?.name ?? null;
    obj.membershipStartDate = membership.startDate;
    obj.membershipExpiryDate = membership.expiryDate;
    obj.membershipStatus = effectiveStatus(membership);
  } else {
    obj.currentMembership = null;
    obj.membershipPlan = null;
    obj.membershipStatus = 'none';
  }
  return obj;
}

export { Member };
