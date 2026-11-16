import { Router } from 'express';
import * as memberships from '../controllers/membershipController';
import { protect, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';

const r = Router();
r.use(protect, authorize('super_admin', 'gym_admin', 'receptionist'));
r.get('/', memberships.listMemberships);
r.get('/upcoming-renewals', memberships.upcomingRenewals);
r.post('/', validate(memberships.assignSchema), memberships.assignMembership);
r.put('/:id', validate(memberships.updateMembershipSchema), memberships.updateMembership);
r.post('/:id/renew', memberships.renewMembership);
export default r;
