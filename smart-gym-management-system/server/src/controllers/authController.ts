import { Request, Response } from 'express';
import { z } from 'zod';
import { User, hashPassword, Role } from '../models/User';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest, unauthorized, notFound } from '../utils/ApiError';
import {
  signAccessToken, signRefreshToken, verifyRefreshToken, hashToken, generateRawToken,
} from '../utils/tokens';
import { env } from '../config/env';
import { writeAudit } from '../utils/audit';

const REFRESH_COOKIE = 'refresh_token';

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.nodeEnv === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  });
}

async function issueTokens(user: InstanceType<typeof User>, res: Response) {
  const accessToken = signAccessToken({ sub: String(user._id), role: user.role, email: user.email });
  const refreshToken = signRefreshToken({ sub: String(user._id) });
  user.refreshTokens = user.refreshTokens.filter(t => t.expiresAt > new Date());
  user.refreshTokens.push({ tokenHash: hashToken(refreshToken), expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000) });
  user.lastLoginAt = new Date();
  await user.save();
  setRefreshCookie(res, refreshToken);
  return accessToken;
}

function publicUser(user: InstanceType<typeof User>) {
  return { id: String(user._id), name: user.name, email: user.email, role: user.role, isActive: user.isActive };
}

export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['super_admin', 'gym_admin', 'receptionist', 'trainer', 'member']).optional(),
});

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password } = req.body as z.infer<typeof registerSchema>;
  // Public self-registration is member-only; staff accounts are created by admins via /api/users.
  const role: Role = 'member';
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw badRequest('An account with this email already exists');
  const user = await User.create({ name, email: email.toLowerCase(), passwordHash: await hashPassword(password), role });
  const accessToken = await issueTokens(user, res);
  await writeAudit({ actorId: String(user._id), action: 'auth.register', entity: 'User', entityId: String(user._id), ip: req.ip });
  res.status(201).json({ success: true, data: { user: publicUser(user), accessToken } });
});

export const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as z.infer<typeof loginSchema>;
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!user || !(await user.comparePassword(password))) throw unauthorized('Invalid email or password');
  if (!user.isActive) throw unauthorized('This account has been deactivated');
  const accessToken = await issueTokens(user, res);
  await writeAudit({ actorId: String(user._id), action: 'auth.login', entity: 'User', entityId: String(user._id), ip: req.ip });
  res.json({ success: true, data: { user: publicUser(user), accessToken } });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = (req.cookies?.[REFRESH_COOKIE] as string | undefined) ?? (req.body?.refreshToken as string | undefined);
  if (!token) throw unauthorized('No refresh token');
  let payload: { sub: string };
  try { payload = verifyRefreshToken(token); } catch { throw unauthorized('Invalid refresh token'); }
  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) throw unauthorized('User not found or inactive');
  const tokenHash = hashToken(token);
  const idx = user.refreshTokens.findIndex(t => t.tokenHash === tokenHash);
  if (idx === -1) {
    // Reuse of an already-rotated token: revoke all sessions for safety.
    user.refreshTokens = [];
    await user.save();
    throw unauthorized('Refresh token reuse detected; all sessions revoked');
  }
  user.refreshTokens.splice(idx, 1); // rotation: old token is single-use
  const accessToken = await issueTokens(user, res);
  res.json({ success: true, data: { accessToken } });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (token && req.user) {
    const user = await User.findById(req.user.id);
    if (user) {
      user.refreshTokens = user.refreshTokens.filter(t => t.tokenHash !== hashToken(token));
      await user.save();
    }
  }
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  res.json({ success: true, message: 'Logged out' });
});

export const forgotPasswordSchema = z.object({ email: z.string().email() });

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body as z.infer<typeof forgotPasswordSchema>;
  const user = await User.findOne({ email: email.toLowerCase() });
  // Always respond the same way to avoid leaking which emails exist.
  if (user) {
    const raw = generateRawToken(32);
    user.passwordResetTokenHash = hashToken(raw);
    user.passwordResetExpires = new Date(Date.now() + env.passwordResetExpiresMinutes * 60 * 1000);
    await user.save();
    // In production this token is emailed. It is returned here only in development
    // so the flow can be tested without an email provider configured.
    const devToken = env.nodeEnv !== 'production' ? raw : undefined;
    await writeAudit({ actorId: String(user._id), action: 'auth.forgot_password', entity: 'User', entityId: String(user._id), ip: req.ip });
    return res.json({ success: true, message: 'If an account exists, a reset link has been sent', ...(devToken ? { resetToken: devToken } : {}) });
  }
  res.json({ success: true, message: 'If an account exists, a reset link has been sent' });
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token, password } = req.body as z.infer<typeof resetPasswordSchema>;
  const user = await User.findOne({
    passwordResetTokenHash: hashToken(token),
    passwordResetExpires: { $gt: new Date() },
  }).select('+passwordResetTokenHash +passwordResetExpires');
  if (!user) throw badRequest('Reset token is invalid or has expired');
  user.passwordHash = await hashPassword(password);
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  user.refreshTokens = [];
  await user.save();
  await writeAudit({ actorId: String(user._id), action: 'auth.reset_password', entity: 'User', entityId: String(user._id), ip: req.ip });
  res.json({ success: true, message: 'Password has been reset. Please log in.' });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.id);
  if (!user) throw notFound('User not found');
  res.json({ success: true, data: publicUser(user) });
});

export const updateProfileSchema = z.object({ name: z.string().min(2).optional() });

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.id);
  if (!user) throw notFound('User not found');
  if (req.body.name) user.name = req.body.name;
  await user.save();
  res.json({ success: true, data: publicUser(user) });
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.id).select('+passwordHash');
  if (!user) throw notFound('User not found');
  const { currentPassword, newPassword } = req.body as z.infer<typeof changePasswordSchema>;
  if (!(await user.comparePassword(currentPassword))) throw badRequest('Current password is incorrect');
  user.passwordHash = await hashPassword(newPassword);
  await user.save();
  res.json({ success: true, message: 'Password changed' });
});

export { publicUser };
