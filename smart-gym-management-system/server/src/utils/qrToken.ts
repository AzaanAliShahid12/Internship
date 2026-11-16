import crypto from 'crypto';

/** A QR credential is a random opaque token. Only its SHA-256 hash is stored. */
export function generateQrToken(): string {
  return 'gymqr_' + crypto.randomBytes(32).toString('base64url');
}
export function hashQrToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
