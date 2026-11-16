import { Router } from 'express';
import * as dashboard from '../controllers/dashboardController';
import { protect, authorize } from '../middleware/auth';

const r = Router();
r.use(protect, authorize('super_admin', 'gym_admin', 'receptionist'));
r.get('/stats', dashboard.dashboardStats);
r.get('/attendance', dashboard.dashboardAttendance);
r.get('/revenue', dashboard.dashboardRevenue);
export default r;
