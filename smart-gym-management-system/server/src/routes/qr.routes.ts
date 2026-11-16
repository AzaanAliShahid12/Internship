import { Router } from 'express';
import * as qr from '../controllers/qrController';
import { protect, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';

const r = Router();
r.use(protect);
r.post('/generate/:memberId', authorize('super_admin', 'gym_admin', 'receptionist'), qr.generateQr);
r.post('/revoke/:memberId', authorize('super_admin', 'gym_admin', 'receptionist'), qr.revokeQr);
r.get('/status/:memberId', authorize('super_admin', 'gym_admin', 'receptionist'), qr.memberQrStatus);
r.post('/verify', authorize('super_admin', 'gym_admin', 'receptionist'), validate(qr.verifySchema), qr.verifyQr);
export default r;
