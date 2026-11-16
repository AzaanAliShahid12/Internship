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

/** Deterministic pseudo-face descriptor: base pattern + small jitter. */
function descriptor(seed: number, jitter = 0): number[] {
  const rand = mulberry32(seed);
  const base = Array.from({ length: 128 }, () => rand() * 2 - 1);
  if (jitter === 0) return base;
  const rand2 = mulberry32(seed * 7 + 1);
  return base.map(v => v + (rand2() - 0.5) * jitter);
}
function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function activeMember() {
  const plan = await request(app).post('/api/plans').set('Authorization', admin)
    .send({ name: `Face Plan ${Math.random()}`, planType: 'monthly', durationDays: 30, price: 5000, status: 'active' });
  const member = await request(app).post('/api/members').set('Authorization', admin)
    .send({ fullName: 'Face Member', email: `face-${Math.random().toString(36).slice(2, 8)}@test.com`, phone: '+92 300 1111111' });
  const memberId = member.body.data._id as string;
  await request(app).post('/api/memberships').set('Authorization', admin)
    .send({ memberId, planId: plan.body.data._id });
  return memberId;
}

describe('Face recognition', () => {
  it('requires explicit consent for enrollment', async () => {
    const memberId = await activeMember();
    const res = await request(app).post('/api/face/enroll').set('Authorization', admin)
      .send({ memberId, samples: [descriptor(1), descriptor(1), descriptor(1)] });
    expect(res.status).toBe(400);
  });

  it('requires at least 3 samples and a 128-length descriptor', async () => {
    const memberId = await activeMember();
    const few = await request(app).post('/api/face/enroll').set('Authorization', admin)
      .send({ memberId, consent: true, samples: [descriptor(1)] });
    expect(few.status).toBe(400);
    const short = await request(app).post('/api/face/enroll').set('Authorization', admin)
      .send({ memberId, consent: true, samples: [[1, 2, 3], [1, 2, 3], [1, 2, 3]] });
    expect(short.status).toBe(400);
  });

  it('enrolls and then matches a near-identical descriptor at check-in', async () => {
    const memberId = await activeMember();
    const samples = [descriptor(42, 0.02), descriptor(42, 0.02), descriptor(42, 0.02), descriptor(42, 0.02)];
    const enroll = await request(app).post('/api/face/enroll').set('Authorization', admin)
      .send({ memberId, consent: true, samples });
    expect(enroll.status).toBe(201);
    expect(enroll.body.data.faceEnrolled).toBe(true);

    const status = await request(app).get(`/api/face/status/${memberId}`).set('Authorization', admin);
    expect(status.body.data.enrolled).toBe(true);
    // The API must never expose descriptor material
    expect(JSON.stringify(status.body)).not.toContain('encryptedDescriptor');

    const verify = await request(app).post('/api/face/verify').set('Authorization', receptionist)
      .send({ descriptor: descriptor(42, 0.03) });
    expect(verify.body.data.allowed).toBe(true);
    expect(verify.body.data.method).toBe('FACE');
    expect(verify.body.data.distance).toBeLessThan(0.6);
  });

  it('rejects an unknown face', async () => {
    const memberId = await activeMember();
    await request(app).post('/api/face/enroll').set('Authorization', admin)
      .send({ memberId, consent: true, samples: [descriptor(42), descriptor(42), descriptor(42)] });
    const verify = await request(app).post('/api/face/verify').set('Authorization', receptionist)
      .send({ descriptor: descriptor(999) });
    expect(verify.body.data.allowed).toBe(false);
    expect(verify.body.data.reason).toContain('Unknown face');
  });

  it('deleting biometric data stops face check-in', async () => {
    const memberId = await activeMember();
    await request(app).post('/api/face/enroll').set('Authorization', admin)
      .send({ memberId, consent: true, samples: [descriptor(7), descriptor(7), descriptor(7)] });
    const del = await request(app).delete(`/api/face/${memberId}`).set('Authorization', admin);
    expect(del.status).toBe(200);
    const verify = await request(app).post('/api/face/verify').set('Authorization', receptionist)
      .send({ descriptor: descriptor(7) });
    expect(verify.body.data.allowed).toBe(false);
  });
});
