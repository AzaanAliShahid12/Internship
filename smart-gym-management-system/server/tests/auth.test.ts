import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startTestServer, stopTestServer, clearDb, request } from './setup';
import type { Express } from 'express';

let app: Express;

beforeAll(async () => { app = await startTestServer(); });
afterAll(async () => { await stopTestServer(); });
beforeEach(async () => { await clearDb(); });

describe('Authentication', () => {
  it('registers a new account as member role and returns tokens', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ name: 'New User', email: 'new@test.com', password: 'Password@123', role: 'gym_admin' });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('member'); // public registration cannot self-assign staff roles
    expect(res.body.data.accessToken).toBeTruthy();
    expect(JSON.stringify(res.headers['set-cookie'] ?? '')).toContain('refresh_token');
  });

  it('rejects duplicate registration', async () => {
    await request(app).post('/api/auth/register').send({ name: 'Aa', email: 'dup@test.com', password: 'Password@123' });
    const res = await request(app).post('/api/auth/register').send({ name: 'Aa', email: 'dup@test.com', password: 'Password@123' });
    expect(res.status).toBe(400);
  });

  it('logs in with valid credentials and rejects invalid ones', async () => {
    await request(app).post('/api/auth/register').send({ name: 'Login User', email: 'login@test.com', password: 'Password@123' });
    const ok = await request(app).post('/api/auth/login').send({ email: 'login@test.com', password: 'Password@123' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.user.email).toBe('login@test.com');
    const bad = await request(app).post('/api/auth/login').send({ email: 'login@test.com', password: 'wrong-password' });
    expect(bad.status).toBe(401);
  });

  it('blocks protected routes without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('refresh rotates the refresh token and rejects reuse of the old one', async () => {
    const reg = await request(app).post('/api/auth/register').send({ name: 'Re Fresh', email: 'refresh@test.com', password: 'Password@123' });
    const cookie1 = reg.headers['set-cookie'];
    const refreshed = await request(app).post('/api/auth/refresh').set('Cookie', cookie1);
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.accessToken).toBeTruthy();
    const reuse = await request(app).post('/api/auth/refresh').set('Cookie', cookie1);
    expect(reuse.status).toBe(401);
  });

  it('supports the forgot/reset password flow', async () => {
    await request(app).post('/api/auth/register').send({ name: 'Fo Rgot', email: 'forgot@test.com', password: 'Password@123' });
    const forgot = await request(app).post('/api/auth/forgot-password').send({ email: 'forgot@test.com' });
    expect(forgot.status).toBe(200);
    const token = forgot.body.resetToken as string;
    expect(token).toBeTruthy(); // dev mode returns the token for testing
    const reset = await request(app).post('/api/auth/reset-password').send({ token, password: 'NewPassword@123' });
    expect(reset.status).toBe(200);
    const login = await request(app).post('/api/auth/login').send({ email: 'forgot@test.com', password: 'NewPassword@123' });
    expect(login.status).toBe(200);
  });

  it('enforces role-based access: members cannot list user accounts', async () => {
    const reg = await request(app).post('/api/auth/register').send({ name: 'Me Mber', email: 'member1@test.com', password: 'Password@123' });
    const token = reg.body.data.accessToken as string;
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
