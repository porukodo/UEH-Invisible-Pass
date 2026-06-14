import { Router } from 'express';
import {
  register,
  verifyEmail,
  login,
  verifyLoginOtp,
  resendOtp,
} from '../controllers/authController.js';

const router = Router();

router.post('/register', register);
router.post('/verify-email', verifyEmail);
router.post('/login', login);
router.post('/login/verify-otp', verifyLoginOtp);
router.post('/resend-otp', resendOtp);

export default router;
