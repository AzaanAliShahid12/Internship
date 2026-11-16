import { Router } from 'express';
import * as devices from '../controllers/deviceController';
import { protect, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';

const r = Router();
r.use(protect, authorize('super_admin', 'gym_admin'));
r.get('/', devices.listDevices);
r.post('/', validate(devices.deviceSchema), devices.createDevice);
r.put('/:id', validate(devices.deviceSchema.partial()), devices.updateDevice);
r.delete('/:id', devices.deleteDevice);
export default r;
