import { Router } from 'express';
import * as trainers from '../controllers/trainerController';
import { protect, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { uploadImage } from '../middleware/upload';

const r = Router();
r.use(protect);
r.get('/me/members', authorize('trainer'), trainers.myMembers);
r.get('/', authorize('super_admin', 'gym_admin', 'receptionist', 'trainer'), trainers.listTrainers);
r.get('/:id', authorize('super_admin', 'gym_admin', 'receptionist', 'trainer'), trainers.getTrainer);
r.post('/', authorize('super_admin', 'gym_admin'), uploadImage.single('profileImage'), validate(trainers.trainerSchema), trainers.createTrainer);
r.put('/:id', authorize('super_admin', 'gym_admin'), uploadImage.single('profileImage'), validate(trainers.trainerSchema.partial()), trainers.updateTrainer);
r.delete('/:id', authorize('super_admin', 'gym_admin'), trainers.deleteTrainer);
r.post('/:id/assign-member', authorize('super_admin', 'gym_admin', 'receptionist'), validate(trainers.assignMemberSchema), trainers.assignMemberToTrainer);
export default r;
