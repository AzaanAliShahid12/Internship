import { Router } from 'express';
import * as members from '../controllers/memberController';
import { protect, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { uploadImage } from '../middleware/upload';
import { memberSchema } from '../controllers/memberController';

const r = Router();
r.use(protect);
r.get('/', authorize('super_admin', 'gym_admin', 'receptionist', 'trainer'), members.listMembers);
r.get('/export/csv', authorize('super_admin', 'gym_admin', 'receptionist'), members.exportMembersCsv);
r.get('/:id', members.getMember);
r.get('/:id/attendance', authorize('super_admin', 'gym_admin', 'receptionist', 'trainer'), members.memberAttendance);
r.get('/:id/payments', authorize('super_admin', 'gym_admin', 'receptionist'), members.memberPayments);
r.post('/', authorize('super_admin', 'gym_admin', 'receptionist'), uploadImage.single('profilePicture'), validate(memberSchema), members.createMember);
r.put('/:id', authorize('super_admin', 'gym_admin', 'receptionist'), uploadImage.single('profilePicture'), validate(memberSchema.partial()), members.updateMember);
r.delete('/:id', authorize('super_admin', 'gym_admin'), members.deleteMember);
export default r;
