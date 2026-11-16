import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startTestServer, stopTestServer, clearDb, request, authHeaderFor } from './setup';
import type { Express } from 'express';

let app: Express;
let admin: string;
let receptionist: string;

beforeAll(async () => { app = await startTestServer(); });
afterAll(async () => { await stopTestServer(); });
beforeEach(async () => {
  await clearDb();
  admin = (await authHeaderFor('gym_admin')).header;
  receptionist = (await authHeaderFor('receptionist')).header;
});

async function memberWithPlan(expiryDays = 30) {
  const plan = await request(app).post('/api/plans').set('Authorization', admin)
    .send({ name: `Plan ${Math.random()}`, planType: 'monthly', durationDays: 30, price: 5000, status: 'active' });
  const member = await request(app).post('/api/members').set('Authorization', admin)
    .send({ fullName: 'QR Member', email: `qr-${Math.random().toString(36).slice(2, 8)}@test.com`, phone: '+92 300 0000000' });
  const memberId = member.body.data._id as string;
  if (expiryDays > 0) {
    await request(app).post('/api/memberships').set('Authorization', admin)
      .send({ memberId, planId: plan.body.data._id });
  } else {
    // Expired: assign then backdate expiry directly via update is not exposed;
    // create membership in the past by assigning and then renewing is not possible —
    // instead assign a 30-day plan and simulate expiry through the model layer.
    const { Membership } = await import('../src/models/Membership');
    const ms = await request(app).post('/api/memberships').set('Authorization', admin)
      .send({ memberId, planId: plan.body.data._id });
    await Membership.findByIdAndUpdate(ms.body.data._id, {
      startDate: new Date(Date.now() - 40 * 86400000),
      expiryDate: new Date(Date.now() - 10 * 86400000),
    });
  }
  return memberId;
}

describe('QR check-in & attendance', () => {
  it('generates a QR credential and verifies a successful check-in', async () => {
    const memberId = await memberWithPlan();
    const gen = await request(app).post(`/api/qr/generate/${memberId}`).set('Authorization', admin);
    expect(gen.status).toBe(201);
    const token = gen.body.data.token as string;
    expect(token).toMatch(/^gymqr_/);
    expect(gen.body.data.qrImage).toContain('data:image/png');

    const verify = await request(app).post('/api/qr/verify').set('Authorization', receptionist).send({ token });
    expect(verify.body.data.allowed).toBe(true);
    expect(verify.body.data.member.memberId).toMatch(/^GYM-/);
    expect(verify.body.data.plan).toBeTruthy();
  });

  it('prevents duplicate check-in while a session is active, then allows after check-out', async () => {
    const memberId = await memberWithPlan();
    const gen = await request(app).post(`/api/qr/generate/${memberId}`).set('Authorization', admin);
    const token = gen.body.data.token as string;
    const first = await request(app).post('/api/qr/verify').set('Authorization', receptionist).send({ token });
    expect(first.body.data.allowed).toBe(true);
    const dup = await request(app).post('/api/qr/verify').set('Authorization', receptionist).send({ token });
    expect(dup.body.data.allowed).toBe(false);
    expect(dup.body.data.reason).toContain('Duplicate');

    const out = await request(app).post('/api/attendance/check-out').set('Authorization', receptionist).send({ memberId });
    expect(out.status).toBe(200);
    const again = await request(app).post('/api/qr/verify').set('Authorization', receptionist).send({ token });
    expect(again.body.data.allowed).toBe(true);
  });

  it('rejects an invalid token and a revoked credential', async () => {
    const memberId = await memberWithPlan();
    const invalid = await request(app).post('/api/qr/verify').set('Authorization', receptionist)
      .send({ token: 'gymqr_totally_invalid_token_value' });
    expect(invalid.body.data.allowed).toBe(false);
    expect(invalid.body.data.reason).toContain('Invalid');

    const gen = await request(app).post(`/api/qr/generate/${memberId}`).set('Authorization', admin);
    const token = gen.body.data.token as string;
    await request(app).post(`/api/qr/revoke/${memberId}`).set('Authorization', admin);
    const revoked = await request(app).post('/api/qr/verify').set('Authorization', receptionist).send({ token });
    expect(revoked.body.data.allowed).toBe(false);
    expect(revoked.body.data.reason).toContain('Revoked');
  });

  it('regenerating a QR revokes the previous token', async () => {
    const memberId = await memberWithPlan();
    const first = await request(app).post(`/api/qr/generate/${memberId}`).set('Authorization', admin);
    const second = await request(app).post(`/api/qr/generate/${memberId}`).set('Authorization', admin);
    const oldToken = await request(app).post('/api/qr/verify').set('Authorization', receptionist)
      .send({ token: first.body.data.token });
    expect(oldToken.body.data.allowed).toBe(false);
    const newToken = await request(app).post('/api/qr/verify').set('Authorization', receptionist)
      .send({ token: second.body.data.token });
    expect(newToken.body.data.allowed).toBe(true);
  });

  it('denies entry when the membership has expired', async () => {
    const memberId = await memberWithPlan(-1);
    const gen = await request(app).post(`/api/qr/generate/${memberId}`).set('Authorization', admin);
    const verify = await request(app).post('/api/qr/verify').set('Authorization', receptionist)
      .send({ token: gen.body.data.token });
    expect(verify.body.data.allowed).toBe(false);
    expect(verify.body.data.reason).toContain('Expired');
  });

  it('denies entry for a suspended member account', async () => {
    const memberId = await memberWithPlan();
    const member = await request(app).get(`/api/members/${memberId}`).set('Authorization', admin);
    await request(app).put(`/api/members/${memberId}`).set('Authorization', admin)
      .send({ fullName: member.body.data.fullName, email: member.body.data.email, phone: member.body.data.phone, status: 'suspended' });
    const gen = await request(app).post(`/api/qr/generate/${memberId}`).set('Authorization', admin);
    const verify = await request(app).post('/api/qr/verify').set('Authorization', receptionist)
      .send({ token: gen.body.data.token });
    expect(verify.body.data.allowed).toBe(false);
    expect(verify.body.data.reason).toContain('Suspended');
  });

  it('manual check-in works for receptionists and today list shows occupancy', async () => {
    const memberId = await memberWithPlan();
    const manual = await request(app).post('/api/attendance/check-in').set('Authorization', receptionist).send({ memberId });
    expect(manual.body.data.allowed).toBe(true);
    const today = await request(app).get('/api/attendance/today').set('Authorization', receptionist);
    expect(today.body.data.total).toBe(1);
    expect(today.body.data.occupancy).toBe(1);
  });
});
