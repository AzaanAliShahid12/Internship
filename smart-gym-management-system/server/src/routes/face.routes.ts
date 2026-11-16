import { Router } from 'express';
import * as face from '../controllers/faceController';
import { protect, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';

const r = Router();
r.use(protect);
r.post('/enroll', authorize('super_admin', 'gym_admin', 'receptionist'), validate(face.enrollSchema), face.enrollFace);
r.post('/verify', authorize('super_admin', 'gym_admin', 'receptionist'), validate(face.verifySchema), face.verifyFace);
r.get('/status/:memberId', authorize('super_admin', 'gym_admin', 'receptionist', 'member'), face.faceStatus);
r.delete('/:memberId', authorize('super_admin', 'gym_admin', 'receptionist', 'member'), face.deleteFace);
export default r;
