import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';

export interface AccessTokenPayload { sub: string; role: string; email: string; }

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.jwtAccessSecret, { expiresIn: env.jwtAccessExpiresIn } as jwt.SignOptions);
}
export function signRefreshToken(payload: { sub: string }): string {
  // jti makes every refresh token unique, so rotation always produces a new
  // token even when two are issued within the same second.
  return jwt.sign({ ...payload, jti: crypto.randomUUID() }, env.jwtRefreshSecret, { expiresIn: env.jwtRefreshExpiresIn } as jwt.SignOptions);
}
export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload;
}
export function verifyRefreshToken(token: string): { sub: string } {
  return jwt.verify(token, env.jwtRefreshSecret) as { sub: string };
}
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
export function generateRawToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}
