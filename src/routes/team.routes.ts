// ============================================
// ComES Backend - Team Routes
// ============================================

import { Router } from 'express';
import {
  getAllMembers,
  getMembersByDepartment,
  getMember,
  createMember,
  updateMember,
  deleteMember,
  reorderMembers,
} from '../controllers/team.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';
import { validate, commonValidations } from '../middleware/validation.middleware';
import { body } from 'express-validator';

const router = Router();

// Validation rules for team members
const teamValidation = {
  create: [
    body('name')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters'),
    body('role')
      .trim()
      .notEmpty()
      .withMessage('Role is required'),
    body('department')
      .isIn(['executive', 'technical', 'creative', 'marketing', 'events', 'finance', 'advisory'])
      .withMessage('Invalid department'),
    body('batch')
      .trim()
      .notEmpty()
      .withMessage('Batch is required'),
    body('term.start')
      .isISO8601()
      .withMessage('Invalid term start date'),
  ],
};

// Public routes
router.get('/', getAllMembers);
router.get('/department/:department', getMembersByDepartment);
router.get('/:id', validate(commonValidations.mongoId('id')), getMember);

// Admin only routes
router.post(
  '/',
  protect,
  restrictTo('admin'),
  validate(teamValidation.create),
  createMember
);
router.patch(
  '/reorder',
  protect,
  restrictTo('admin'),
  reorderMembers
);
router.patch(
  '/:id',
  protect,
  restrictTo('admin'),
  validate(commonValidations.mongoId('id')),
  updateMember
);
router.delete(
  '/:id',
  protect,
  restrictTo('admin'),
  validate(commonValidations.mongoId('id')),
  deleteMember
);

export default router;
