import dotenv from 'dotenv';
dotenv.config();

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

export const env = {
  port: Number(process.env.PORT ?? 5000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
  mongoUri: required('MONGODB_URI', 'mongodb://127.0.0.1:27017/gym-management-system'),
  jwtAccessSecret: required('JWT_ACCESS_SECRET', 'dev-access-secret-change-me-please-32chars'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me-please-32chars'),
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  biometricKey: required('BIOMETRIC_ENCRYPTION_KEY', '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
  faceMatchThreshold: Number(process.env.FACE_MATCH_THRESHOLD ?? 0.6),
  passwordResetExpiresMinutes: Number(process.env.PASSWORD_RESET_EXPIRES_MINUTES ?? 30),
};
