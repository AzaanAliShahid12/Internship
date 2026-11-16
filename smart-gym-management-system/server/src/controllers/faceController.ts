import { Request, Response } from 'express';
import { z } from 'zod';
import { Member } from '../models/Member';
import { BiometricProfile } from '../models/BiometricProfile';
import { Device } from '../models/Device';
import { asyncHandler } from '../utils/asyncHandler';
import { notFound, forbidden } from '../utils/ApiError';
import { encryptDescriptor, decryptDescriptor } from '../utils/crypto';
import { averageDescriptors, findBestMatch } from '../utils/faceMatch';
import { performCheckIn } from '../services/attendanceService';
import { env } from '../config/env';
import { writeAudit } from '../utils/audit';
import { publicMember } from './qrController';

const descriptorSchema = z.array(z.number()).length(128);

export const enrollSchema = z.object({
  memberId: z.string().min(1),
  consent: z.literal(true, { errorMap: () => ({ message: 'Explicit biometric consent is required' }) }),
  samples: z.array(descriptorSchema).min(3, 'At least 3 face samples are required').max(10),
});

/**
 * Enroll a member's face: average the sample descriptors into one template,
 * encrypt it with AES-256-GCM and store it. Raw images are never stored.
 */
export const enrollFace = asyncHandler(async (req: Request, res: Response) => {
  const { memberId, samples } = req.body as z.infer<typeof enrollSchema>;
  const member = await Member.findById(memberId);
  if (!member) throw notFound('Member not found');
  const template = averageDescriptors(samples);
  const encryptedDescriptor = encryptDescriptor(template);
  const profile = await BiometricProfile.findOneAndUpdate(
    { member: member._id },
    {
      member: member._id, encryptedDescriptor, samplesCount: samples.length,
      consentGiven: true, consentAt: new Date(), status: 'active', enrolledBy: req.user!.id,
    },
    { upsert: true, new: true }
  );
  member.faceEnrolled = true;
  await member.save();
  await writeAudit({ actorId: req.user!.id, action: 'face.enroll', entity: 'BiometricProfile', entityId: String(profile._id), details: { memberId: member.memberId, samples: samples.length }, ip: req.ip });
  res.status(201).json({
    success: true,
    data: { memberId: member.memberId, faceEnrolled: true, samplesCount: samples.length, enrolledAt: profile.updatedAt },
  });
});

export const verifySchema = z.object({
  descriptor: descriptorSchema,
  deviceId: z.string().optional(),
});

/**
 * Face check-in: decrypt enrolled templates, find the best Euclidean match
 * under the configured threshold, then run the shared check-in pipeline.
 * Unknown faces are rejected. Descriptors are never returned.
 */
export const verifyFace = asyncHandler(async (req: Request, res: Response) => {
  const { descriptor, deviceId } = req.body as z.infer<typeof verifySchema>;
  const profiles = await BiometricProfile.find({ status: 'active' }).select('+encryptedDescriptor');
  const candidates = profiles.map(p => ({
    memberId: String(p.member),
    descriptor: decryptDescriptor(p.encryptedDescriptor),
  }));
  const match = findBestMatch(descriptor, candidates, env.faceMatchThreshold);
  if (!match) {
    return res.json({ success: true, data: { allowed: false, reason: 'Unknown face — no enrolled member matched' } });
  }
  const member = await Member.findById(match.memberId);
  if (!member) return res.json({ success: true, data: { allowed: false, reason: 'Member not found' } });

  let device: string | undefined;
  if (deviceId) {
    const d = await Device.findById(deviceId);
    if (d) { device = String(d._id); d.lastSeenAt = new Date(); await d.save(); }
  }

  const outcome = await performCheckIn({ member, method: 'FACE', deviceId: device, faceDistance: match.distance });
  if (!outcome.success) {
    return res.json({ success: true, data: { allowed: false, reason: outcome.reason, member: publicMember(member), distance: match.distance } });
  }
  res.json({
    success: true,
    data: {
      allowed: true, member: publicMember(member), plan: outcome.planName,
      expiryDate: outcome.expiryDate, checkInAt: outcome.attendance?.checkInAt,
      method: 'FACE', distance: match.distance,
    },
  });
});

export const faceStatus = asyncHandler(async (req: Request, res: Response) => {
  const member = await Member.findById(req.params.memberId);
  if (!member) throw notFound('Member not found');
  const profile = await BiometricProfile.findOne({ member: member._id });
  res.json({
    success: true,
    data: {
      memberId: member.memberId,
      enrolled: Boolean(profile && profile.status === 'active'),
      consentGiven: profile?.consentGiven ?? false,
      samplesCount: profile?.samplesCount ?? 0,
      enrolledAt: profile?.createdAt,
      updatedAt: profile?.updatedAt,
    },
  });
});

/** Delete a member's biometric data (consent withdrawal). Audited. */
export const deleteFace = asyncHandler(async (req: Request, res: Response) => {
  const member = await Member.findById(req.params.memberId);
  if (!member) throw notFound('Member not found');
  if (req.user!.role === 'member' && String(member.user ?? '') !== req.user!.id) {
    throw forbidden('You can only delete your own biometric data');
  }
  const profile = await BiometricProfile.findOne({ member: member._id });
  if (profile) {
    profile.status = 'deleted';
    profile.encryptedDescriptor = encryptDescriptor(new Array(128).fill(0)); // overwrite template material
    profile.consentGiven = false;
    await profile.save();
  }
  member.faceEnrolled = false;
  await member.save();
  await writeAudit({ actorId: req.user!.id, action: 'face.delete', entity: 'BiometricProfile', entityId: String(member._id), details: { memberId: member.memberId }, ip: req.ip });
  res.json({ success: true, message: 'Biometric data deleted' });
});

