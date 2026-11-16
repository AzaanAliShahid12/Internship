import { Router } from 'express';
import * as portal from '../controllers/portalController';
import { myProfile } from '../controllers/memberController';
import { myQr } from '../controllers/qrController';
import { protect, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { uploadImage } from '../middleware/upload';

const r = Router();
r.use(protect, authorize('member'));
r.get('/profile', myProfile);
r.put('/profile', uploadImage.single('profilePicture'), validate(portal.updateMyProfileSchema), portal.updateMyProfile);
r.get('/qr', myQr);
r.get('/attendance', portal.myAttendance);
r.get('/payments', portal.myPayments);
r.get('/membership', portal.myMembership);
r.post('/renewal-request', portal.requestRenewal);
export default r;
