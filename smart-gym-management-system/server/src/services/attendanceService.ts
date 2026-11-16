import { Attendance, IAttendance, todayStr, CheckInMethod } from '../models/Attendance';
import { IMember } from '../models/Member';
import { checkEligibility } from './membershipService';
import { notify } from './notificationService';
import { emitToStaff } from '../sockets/socket';
import { badRequest } from '../utils/ApiError';

export interface CheckInOutcome {
  success: boolean;
  reason?: string;
  attendance?: IAttendance;
  member: IMember;
  membershipStatus?: string;
  planName?: string;
  expiryDate?: Date;
}

async function logRejected(member: IMember, method: CheckInMethod, reason: string, deviceId?: string, faceDistance?: number) {
  await Attendance.create({
    member: member._id,
    method,
    date: todayStr(),
    verificationResult: 'rejected',
    rejectionReason: reason,
    entryDevice: deviceId,
    faceDistance,
    status: 'checked_out',
  });
  await notify({
    type: 'check_in_rejected',
    title: 'Check-in rejected',
    message: `${member.fullName} (${member.memberId}) was denied entry: ${reason}`,
    memberId: String(member._id),
  });
  emitToStaff('attendance:rejected', { memberId: member.memberId, name: member.fullName, reason, method });
}

/**
 * Single check-in pipeline shared by QR, face and manual entry points.
 * Verifies eligibility, blocks duplicate active sessions, records attendance,
 * and pushes real-time events to staff dashboards.
 */
export async function performCheckIn(params: {
  member: IMember;
  method: CheckInMethod;
  deviceId?: string;
  faceDistance?: number;
}): Promise<CheckInOutcome> {
  const { member, method, deviceId, faceDistance } = params;

  const eligibility = await checkEligibility(member);
  const plan = eligibility.membership?.plan as unknown as { name?: string } | undefined;

  if (!eligibility.allowed) {
    await logRejected(member, method, eligibility.reason ?? 'Not eligible', deviceId, faceDistance);
    return { success: false, reason: eligibility.reason, member, membershipStatus: 'denied' };
  }

  const active = await Attendance.findOne({
    member: member._id, status: 'checked_in', verificationResult: 'success',
  });
  if (active) {
    await logRejected(member, method, 'Duplicate check-in (already inside the gym)', deviceId, faceDistance);
    return { success: false, reason: 'Duplicate check-in', member };
  }

  const attendance = await Attendance.create({
    member: member._id,
    method,
    date: todayStr(),
    entryDevice: deviceId,
    faceDistance,
    verificationResult: 'success',
    status: 'checked_in',
  });

  await notify({
    type: 'check_in_success',
    title: 'Member checked in',
    message: `${member.fullName} (${member.memberId}) checked in via ${method}`,
    memberId: String(member._id),
  });
  const occupancy = await Attendance.countDocuments({ status: 'checked_in', verificationResult: 'success' });
  emitToStaff('attendance:checkin', {
    memberId: member.memberId,
    name: member.fullName,
    method,
    checkInAt: attendance.checkInAt,
    occupancy,
  });
  emitToStaff('dashboard:refresh', {});

  return {
    success: true,
    attendance,
    member,
    membershipStatus: 'active',
    planName: plan?.name,
    expiryDate: eligibility.membership?.expiryDate,
  };
}

export async function performCheckOut(memberId: string) {
  const active = await Attendance.findOne({
    member: memberId, status: 'checked_in', verificationResult: 'success',
  }).sort({ checkInAt: -1 });
  if (!active) throw badRequest('No active check-in session found for this member');
  active.checkOutAt = new Date();
  active.status = 'checked_out';
  await active.save();
  const occupancy = await Attendance.countDocuments({ status: 'checked_in', verificationResult: 'success' });
  emitToStaff('attendance:checkout', { member: memberId, occupancy });
  emitToStaff('dashboard:refresh', {});
  return active;
}

export async function currentOccupancy(): Promise<number> {
  return Attendance.countDocuments({ status: 'checked_in', verificationResult: 'success' });
}
