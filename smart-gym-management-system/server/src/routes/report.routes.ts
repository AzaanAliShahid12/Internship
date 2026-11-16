import { Router } from 'express';
import * as reports from '../controllers/reportController';
import { protect, authorize } from '../middleware/auth';

const r = Router();
r.use(protect, authorize('super_admin', 'gym_admin', 'receptionist'));
r.get('/attendance', reports.attendanceReport);
r.get('/revenue', reports.revenueReport);
r.get('/memberships', reports.membershipsReport);
r.get('/rejected', reports.rejectedReport);
r.get('/occupancy', reports.occupancyReport);
r.get('/registrations', reports.registrationsReport);
export default r;
