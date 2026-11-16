import { Request, Response } from 'express';
import { z } from 'zod';
import { Payment, PAYMENT_METHODS } from '../models/Payment';
import { Member } from '../models/Member';
import { Membership } from '../models/Membership'; // used for membership lookups in receipt flow
import { MembershipPlan } from '../models/MembershipPlan';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest, notFound } from '../utils/ApiError';
import { pageParams, pageResult } from '../utils/pagination';
import { writeAudit } from '../utils/audit';
import { notify } from '../services/notificationService';

export const paymentSchema = z.object({
  memberId: z.string().min(1),
  planId: z.string().optional(),
  membershipId: z.string().optional(),
  amount: z.number().min(0),
  discount: z.number().min(0).optional(),
  method: z.enum(PAYMENT_METHODS),
  status: z.enum(['pending', 'completed', 'failed', 'refunded']).optional(),
  transactionReference: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * Record a payment. A payment is only stored as "completed" when the caller
 * explicitly confirms it (authorized staff action) — otherwise it stays pending.
 */
export const createPayment = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as z.infer<typeof paymentSchema>;
  const member = await Member.findById(body.memberId);
  if (!member) throw notFound('Member not found');
  if (body.discount && body.discount > body.amount) throw badRequest('Discount cannot exceed the amount');
  const payment = await Payment.create({
    member: member._id,
    plan: body.planId,
    membership: body.membershipId,
    amount: body.amount,
    discount: body.discount ?? 0,
    method: body.method,
    status: body.status ?? 'pending',
    transactionReference: body.transactionReference,
    notes: body.notes,
    recordedBy: req.user!.id,
  });
  await payment.populate('plan', 'name');
  if (payment.status === 'completed') {
    await notify({ type: 'payment_received', title: 'Payment received', message: `${member.fullName} paid ${payment.amount - payment.discount} via ${payment.method} (${payment.paymentId})`, memberId: String(member._id) });
  }
  await writeAudit({ actorId: req.user!.id, action: 'payment.create', entity: 'Payment', entityId: String(payment._id), details: { paymentId: payment.paymentId, status: payment.status }, ip: req.ip });
  res.status(201).json({ success: true, data: payment });
});

export const listPayments = asyncHandler(async (req: Request, res: Response) => {
  const p = pageParams(req);
  const filter: Record<string, unknown> = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.method) filter.method = req.query.method;
  if (req.query.member) filter.member = req.query.member;
  if (req.query.from || req.query.to) {
    filter.paidAt = {};
    if (req.query.from) (filter.paidAt as Record<string, unknown>).$gte = new Date(String(req.query.from));
    if (req.query.to) (filter.paidAt as Record<string, unknown>).$lte = new Date(String(req.query.to));
  }
  const [items, total] = await Promise.all([
    Payment.find(filter).populate('member', 'fullName memberId').populate('plan', 'name').sort({ paidAt: -1 }).skip(p.skip).limit(p.limit),
    Payment.countDocuments(filter),
  ]);
  res.json({ success: true, data: pageResult(items, total, p) });
});

export const getPayment = asyncHandler(async (req: Request, res: Response) => {
  const payment = await Payment.findById(req.params.id)
    .populate('member', 'fullName memberId email phone')
    .populate('plan', 'name price durationDays')
    .populate('membership');
  if (!payment) throw notFound('Payment not found');
  res.json({ success: true, data: payment });
});

export const updatePaymentSchema = z.object({
  status: z.enum(['pending', 'completed', 'failed', 'refunded']),
  transactionReference: z.string().optional(),
});

export const updatePaymentStatus = asyncHandler(async (req: Request, res: Response) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment) throw notFound('Payment not found');
  const { status, transactionReference } = req.body as z.infer<typeof updatePaymentSchema>;
  const wasCompleted = payment.status === 'completed';
  payment.status = status;
  if (transactionReference) payment.transactionReference = transactionReference;
  await payment.save();
  if (status === 'completed' && !wasCompleted) {
    const member = await Member.findById(payment.member);
    await notify({ type: 'payment_received', title: 'Payment received', message: `${member?.fullName ?? 'Member'} paid ${payment.amount - payment.discount} (${payment.paymentId})`, memberId: String(payment.member) });
  }
  await writeAudit({ actorId: req.user!.id, action: 'payment.status', entity: 'Payment', entityId: String(payment._id), details: { status }, ip: req.ip });
  res.json({ success: true, data: payment });
});

/** Printable invoice/receipt data for one payment. */
export const paymentReceipt = asyncHandler(async (req: Request, res: Response) => {
  const payment = await Payment.findById(req.params.id)
    .populate('member', 'fullName memberId email phone')
    .populate('plan', 'name');
  if (!payment) throw notFound('Payment not found');
  const member = payment.member as unknown as { fullName: string; memberId: string; email: string; phone: string };
  const plan = payment.plan as unknown as { name?: string } | undefined;
  res.json({
    success: true,
    data: {
      receiptNo: payment.paymentId,
      date: payment.paidAt,
      member: member.fullName, memberId: member.memberId, email: member.email, phone: member.phone,
      plan: plan?.name ?? '—',
      amount: payment.amount, discount: payment.discount, total: payment.amount - payment.discount,
      method: payment.method, status: payment.status, transactionReference: payment.transactionReference,
    },
  });
});

