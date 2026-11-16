import { Router } from 'express';
import * as attendance from '../controllers/attendanceController';
import { protect, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';

const r = Router();
r.use(protect);
r.post('/check-in', authorize('super_admin', 'gym_admin', 'receptionist'), validate(attendance.manualCheckInSchema), attendance.manualCheckIn);
r.post('/check-out', authorize('super_admin', 'gym_admin', 'receptionist'), validate(attendance.checkOutSchema), attendance.checkOut);
r.get('/', authorize('super_admin', 'gym_admin', 'receptionist', 'trainer'), attendance.listAttendance);
r.get('/today', authorize('super_admin', 'gym_admin', 'receptionist'), attendance.todayAttendance);
r.get('/occupancy', authorize('super_admin', 'gym_admin', 'receptionist'), attendance.occupancy);
r.get('/export/csv', authorize('super_admin', 'gym_admin', 'receptionist'), attendance.exportAttendanceCsv);
r.get('/member/:memberId', authorize('super_admin', 'gym_admin', 'receptionist', 'trainer'), attendance.memberAttendanceList);
export default r;
