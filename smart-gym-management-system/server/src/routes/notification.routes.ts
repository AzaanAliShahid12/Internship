import { Router } from 'express';
import * as notifications from '../controllers/notificationController';
import { protect } from '../middleware/auth';

const r = Router();
r.use(protect);
r.get('/', notifications.listNotifications);
r.put('/read-all', notifications.markAllRead);
r.put('/:id/read', notifications.markRead);
export default r;
