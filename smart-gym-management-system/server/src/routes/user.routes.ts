import { Router } from 'express';
import * as users from '../controllers/userController';
import { protect, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';

const r = Router();
r.use(protect, authorize('super_admin', 'gym_admin'));
r.get('/', users.listUsers);
r.post('/', validate(users.createUserSchema), users.createUser);
r.put('/:id', validate(users.updateUserSchema), users.updateUser);
r.delete('/:id', users.deleteUser);
export default r;
