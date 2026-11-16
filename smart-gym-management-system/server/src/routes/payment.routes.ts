import { Router } from 'express';
import * as payments from '../controllers/paymentController';
import { protect, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';

const r = Router();
r.use(protect, authorize('super_admin', 'gym_admin', 'receptionist'));
r.get('/', payments.listPayments);
r.get('/:id', payments.getPayment);
r.get('/:id/receipt', payments.paymentReceipt);
r.post('/', validate(payments.paymentSchema), payments.createPayment);
r.put('/:id/status', validate(payments.updatePaymentSchema), payments.updatePaymentStatus);
export default r;
