// ============================================
// ComES Backend - User Routes
// ============================================

import { Router } from 'express';
import {
  getAllUsers,
  getUser,
  updateMe,
  deleteMe,
  updateUser,
  deleteUser,
} from '../controllers/user.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';
import { validate, userValidations, commonValidations } from '../middleware/validation.middleware';

const router = Router();

// All routes require authentication
router.use(protect);

// Current user routes
router.patch('/me', validate(userValidations.updateProfile), updateMe);
router.delete('/me', deleteMe);

// Admin only routes
router.use(restrictTo('admin'));

router.get('/', getAllUsers);
router.get('/:id', validate(commonValidations.mongoId('id')), getUser);
router.patch('/:id', validate(commonValidations.mongoId('id')), updateUser);
router.delete('/:id', validate(commonValidations.mongoId('id')), deleteUser);

export default router;
