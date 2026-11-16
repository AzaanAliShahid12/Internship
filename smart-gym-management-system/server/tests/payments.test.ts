import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startTestServer, stopTestServer, clearDb, request, authHeaderFor } from './setup';
import type { Express } from 'express';

let app: Express;
let admin: string;
let memberId: string;

beforeAll(async () => { app = await startTestServer(); });
afterAll(async () => { await stopTestServer(); });
beforeEach(async () => {
  await clearDb();
  admin = (await authHeaderFor('gym_admin')).header;
  const member = await request(app).post('/api/members').set('Authorization', admin)
    .send({ fullName: 'Pay Member', email: 'pay@test.com', phone: '+92 300 2222222' });
  memberId = member.body.data._id as string;
});

describe('Payments', () => {
  it('records a pending payment and completes it after confirmation', async () => {
    const created = await request(app).post('/api/payments').set('Authorization', admin)
      .send({ memberId, amount: 5000, discount: 500, method: 'cash' });
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('pending');
    expect(created.body.data.paymentId).toMatch(/^PAY-\d{5}$/);

    const id = created.body.data._id as string;
    const updated = await request(app).put(`/api/payments/${id}/status`).set('Authorization', admin)
      .send({ status: 'completed', transactionReference: 'TXN-1' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.status).toBe('completed');

    const list = await request(app).get('/api/payments?status=completed').set('Authorization', admin);
    expect(list.body.data.total).toBe(1);
  });

  it('rejects a discount larger than the amount', async () => {
    const res = await request(app).post('/api/payments').set('Authorization', admin)
      .send({ memberId, amount: 1000, discount: 1500, method: 'cash' });
    expect(res.status).toBe(400);
  });

  it('generates receipt data with the discounted total', async () => {
    const created = await request(app).post('/api/payments').set('Authorization', admin)
      .send({ memberId, amount: 5000, discount: 500, method: 'card', status: 'completed' });
    const receipt = await request(app).get(`/api/payments/${created.body.data._id}/receipt`).set('Authorization', admin);
    expect(receipt.status).toBe(200);
    expect(receipt.body.data.total).toBe(4500);
    expect(receipt.body.data.member).toBe('Pay Member');
  });

  it('dashboard stats and revenue report reflect completed payments', async () => {
    await request(app).post('/api/payments').set('Authorization', admin)
      .send({ memberId, amount: 5000, discount: 0, method: 'cash', status: 'completed' });
    await request(app).post('/api/payments').set('Authorization', admin)
      .send({ memberId, amount: 3000, discount: 0, method: 'cash', status: 'pending' });
    const stats = await request(app).get('/api/dashboard/stats').set('Authorization', admin);
    expect(stats.body.data.monthlyRevenue).toBe(5000);
    expect(stats.body.data.pendingPayments).toBe(1);
    const report = await request(app).get('/api/reports/revenue').set('Authorization', admin);
    expect(report.body.data.totalRevenue).toBe(5000);
  });
});
