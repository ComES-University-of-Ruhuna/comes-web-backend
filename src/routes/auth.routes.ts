// ============================================
// ComES Backend - Auth Routes
// ============================================

import { Router } from 'express';
import {
  register,
  login,
  logout,
  refreshToken,
  forgotPassword,
  resetPassword,
  updatePassword,
  getMe,
  createAdmin,
} from '../controllers/auth.controller';
import { protect } from '../middleware/auth.middleware';
import { validate, authValidations } from '../middleware/validation.middleware';

const router = Router();

// Public routes
router.post('/register', validate(authValidations.register), register);
router.post('/login', validate(authValidations.login), login);
router.post('/logout', logout);
router.post('/refresh-token', refreshToken);
router.post('/forgot-password', validate(authValidations.forgotPassword), forgotPassword);
router.patch('/reset-password/:token', validate(authValidations.resetPassword), resetPassword);
router.post('/create-admin', createAdmin);

// Protected routes
router.use(protect);
router.patch('/update-password', validate(authValidations.updatePassword), updatePassword);
router.get('/me', getMe);

export default router;
