import { Router } from 'express';
import * as auth from '../controllers/authController';
import { protect } from '../middleware/auth';
import { validate } from '../middleware/validate';

const r = Router();
r.post('/register', validate(auth.registerSchema), auth.register);
r.post('/login', validate(auth.loginSchema), auth.login);
r.post('/refresh', auth.refresh);
r.post('/logout', protect, auth.logout);
r.post('/forgot-password', validate(auth.forgotPasswordSchema), auth.forgotPassword);
r.post('/reset-password', validate(auth.resetPasswordSchema), auth.resetPassword);
r.get('/me', protect, auth.me);
r.put('/profile', protect, validate(auth.updateProfileSchema), auth.updateProfile);
r.post('/change-password', protect, validate(auth.changePasswordSchema), auth.changePassword);
export default r;
