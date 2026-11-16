import { Router } from 'express';
import { listAuditLogs } from '../controllers/auditController';
import { protect, authorize } from '../middleware/auth';

const r = Router();
r.use(protect, authorize('super_admin', 'gym_admin'));
r.get('/', listAuditLogs);
export default r;
