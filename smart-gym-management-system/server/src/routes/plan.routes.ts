import { Router } from 'express';
import * as plans from '../controllers/planController';
import { protect, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';

const r = Router();
r.use(protect);
r.get('/', plans.listPlans);
r.get('/:id', plans.getPlan);
r.post('/', authorize('super_admin', 'gym_admin'), validate(plans.planSchema), plans.createPlan);
r.put('/:id', authorize('super_admin', 'gym_admin'), validate(plans.planSchema.partial()), plans.updatePlan);
r.delete('/:id', authorize('super_admin', 'gym_admin'), plans.deletePlan);
export default r;
