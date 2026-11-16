import { Request, Response } from 'express';
import { z } from 'zod';
import QRCode from 'qrcode';
import { Member } from '../models/Member';
import { QrCredential } from '../models/QrCredential';
import { Device } from '../models/Device';
import { asyncHandler } from '../utils/asyncHandler';
import { notFound } from '../utils/ApiError';
import { generateQrToken, hashQrToken } from '../utils/qrToken';
import { encryptString, decryptString } from '../utils/crypto';
import { performCheckIn } from '../services/attendanceService';
import { getCurrentMembership, checkEligibility } from '../services/membershipService';
import { effectiveStatus } from '../models/Membership';
import { writeAudit } from '../utils/audit';

/**
 * Generate (or regenerate) a member's QR credential.
 * The raw token is returned ONCE here together with a printable QR image.
 * Only the SHA-256 hash of the token is stored. Regenerating revokes the old credential.
 */
export const generateQr = asyncHandler(async (req: Request, res: Response) => {
  const member = await Member.findById(req.params.memberId);
  if (!member) throw notFound('Member not found');
  await QrCredential.updateMany({ member: member._id, status: 'active' }, { status: 'revoked', revokedAt: new Date() });
  const token = generateQrToken();
  const cred = await QrCredential.create({ member: member._id, tokenHash: hashQrToken(token), encryptedToken: encryptString(token), status: 'active' });
  const qrImage = await QRCode.toDataURL(token, { width: 320, margin: 2 });
  await writeAudit({ actorId: req.user!.id, action: 'qr.generate', entity: 'QrCredential', entityId: String(cred._id), details: { memberId: member.memberId }, ip: req.ip });
  res.status(201).json({
    success: true,
    data: { credentialId: String(cred._id), token, qrImage, member: { id: String(member._id), memberId: member.memberId, fullName: member.fullName } },
  });
});

export const revokeQr = asyncHandler(async (req: Request, res: Response) => {
  const member = await Member.findById(req.params.memberId);
  if (!member) throw notFound('Member not found');
  const result = await QrCredential.updateMany({ member: member._id, status: 'active' }, { status: 'revoked', revokedAt: new Date() });
  await writeAudit({ actorId: req.user!.id, action: 'qr.revoke', entity: 'Member', entityId: String(member._id), details: { revoked: result.modifiedCount }, ip: req.ip });
  res.json({ success: true, message: 'QR credential revoked' });
});

/** Member portal: get my own QR image. Returns the image for the active credential. */
export const myQr = asyncHandler(async (req: Request, res: Response) => {
  const member = await Member.findOne({ user: req.user!.id });
  if (!member) throw notFound('No member profile is linked to this account');
  const cred = await QrCredential.findOne({ member: member._id, status: 'active' }).select('+encryptedToken');
  if (!cred) {
    return res.json({ success: true, data: { hasCredential: false, message: 'No QR code yet. Please ask the front desk to generate one.' } });
  }
  // The token is stored only in encrypted form; decrypt server-side to render the image.
  const token = decryptString(cred.encryptedToken);
  const qrImage = await QRCode.toDataURL(token, { width: 320, margin: 2 });
  res.json({
    success: true,
    data: { hasCredential: true, credentialId: String(cred._id), createdAt: cred.createdAt, memberId: member.memberId, fullName: member.fullName, qrImage },
  });
});

export const verifySchema = z.object({
  token: z.string().min(10),
  deviceId: z.string().optional(),
});

/**
 * Entrance verification: hash the scanned token, look up the credential,
 * then run the shared eligibility + duplicate-session pipeline.
 */
export const verifyQr = asyncHandler(async (req: Request, res: Response) => {
  const { token, deviceId } = req.body as z.infer<typeof verifySchema>;
  const cred = await QrCredential.findOne({ tokenHash: hashQrToken(token) }).select('+tokenHash');
  if (!cred) {
    return res.status(200).json({ success: true, data: { allowed: false, reason: 'Invalid QR code' } });
  }
  if (cred.status === 'revoked') {
    return res.status(200).json({ success: true, data: { allowed: false, reason: 'Revoked QR code' } });
  }
  const member = await Member.findById(cred.member);
  if (!member) return res.status(200).json({ success: true, data: { allowed: false, reason: 'Member not found' } });

  let device: string | undefined;
  if (deviceId) {
    const d = await Device.findById(deviceId);
    if (d) { device = String(d._id); d.lastSeenAt = new Date(); await d.save(); }
  }

  const outcome = await performCheckIn({ member, method: 'QR', deviceId: device });
  cred.lastUsedAt = new Date();
  await cred.save();

  if (!outcome.success) {
    return res.json({ success: true, data: { allowed: false, reason: outcome.reason, member: publicMember(member) } });
  }
  res.json({
    success: true,
    data: {
      allowed: true,
      member: publicMember(member),
      plan: outcome.planName,
      expiryDate: outcome.expiryDate,
      checkInAt: outcome.attendance?.checkInAt,
      method: 'QR',
    },
  });
});

function publicMember(member: InstanceType<typeof Member>) {
  return {
    id: String(member._id), memberId: member.memberId, fullName: member.fullName,
    profilePicture: member.profilePicture, status: member.status,
  };
}

export { publicMember };

/** Staff helper used by the QR generator page: membership summary for a member. */
export const memberQrStatus = asyncHandler(async (req: Request, res: Response) => {
  const member = await Member.findById(req.params.memberId);
  if (!member) throw notFound('Member not found');
  const cred = await QrCredential.findOne({ member: member._id, status: 'active' });
  const membership = await getCurrentMembership(String(member._id));
  const eligibility = await checkEligibility(member);
  res.json({
    success: true,
    data: {
      member: publicMember(member),
      hasActiveCredential: Boolean(cred),
      credentialCreatedAt: cred?.createdAt,
      eligible: eligibility.allowed,
      eligibilityReason: eligibility.reason,
      membershipStatus: membership ? effectiveStatus(membership) : 'none',
    },
  });
});

