import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startTestServer, stopTestServer, clearDb, request, authHeaderFor } from './setup';
import type { Express } from 'express';

let app: Express;
let admin: string;
let receptionist: string;
let memberRole: string;

beforeAll(async () => { app = await startTestServer(); });
afterAll(async () => { await stopTestServer(); });
beforeEach(async () => {
  await clearDb();
  admin = (await authHeaderFor('gym_admin')).header;
  receptionist = (await authHeaderFor('receptionist')).header;
  memberRole = (await authHeaderFor('member')).header;
});

const sample = { fullName: 'Test Member', email: 'tm@test.com', phone: '+92 300 1234567' };

describe('Members', () => {
  it('admin can create a member with a generated member ID', async () => {
    const res = await request(app).post('/api/members').set('Authorization', admin).send(sample);
    expect(res.status).toBe(201);
    expect(res.body.data.memberId).toMatch(/^GYM-\d{4}$/);
    expect(res.body.data.membershipStatus).toBe('none');
  });

  it('rejects duplicate member email', async () => {
    await request(app).post('/api/members').set('Authorization', admin).send(sample);
    const res = await request(app).post('/api/members').set('Authorization', admin).send(sample);
    expect(res.status).toBe(400);
  });

  it('member role cannot create members', async () => {
    const res = await request(app).post('/api/members').set('Authorization', memberRole).send(sample);
    expect(res.status).toBe(403);
  });

  it('receptionist can list and search members', async () => {
    await request(app).post('/api/members').set('Authorization', admin).send(sample);
    const res = await request(app).get('/api/members?search=Test').set('Authorization', receptionist);
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
  });

  it('updates and deactivates a member', async () => {
    const created = await request(app).post('/api/members').set('Authorization', admin).send(sample);
    const id = created.body.data._id as string;
    const updated = await request(app).put(`/api/members/${id}`).set('Authorization', admin)
      .send({ ...sample, phone: '+92 311 9999999' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.phone).toBe('+92 311 9999999');
    const removed = await request(app).delete(`/api/members/${id}`).set('Authorization', admin);
    expect(removed.status).toBe(200);
    const after = await request(app).get(`/api/members/${id}`).set('Authorization', admin);
    expect(after.body.data.status).toBe('inactive');
  });

  it('exports members as CSV', async () => {
    await request(app).post('/api/members').set('Authorization', admin).send(sample);
    const res = await request(app).get('/api/members/export/csv').set('Authorization', admin);
    expect(res.status).toBe(200);
    expect(res.text).toContain('Member ID');
    expect(res.text).toContain('tm@test.com');
  });
});
