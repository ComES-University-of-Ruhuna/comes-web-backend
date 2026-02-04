// ============================================
// ComES Backend - Project Routes
// ============================================

import { Router } from 'express';
import {
  getAllProjects,
  getFeaturedProjects,
  getCategories,
  getProject,
  getProjectBySlug,
  createProject,
  updateProject,
  deleteProject,
  likeProject,
} from '../controllers/project.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';
import { validate, commonValidations } from '../middleware/validation.middleware';
import { body } from 'express-validator';

const router = Router();

// Validation rules for projects
const projectValidation = {
  create: [
    body('title')
      .trim()
      .isLength({ min: 3, max: 200 })
      .withMessage('Title must be between 3 and 200 characters'),
    body('description')
      .trim()
      .isLength({ min: 10 })
      .withMessage('Description must be at least 10 characters'),
    body('category')
      .trim()
      .notEmpty()
      .withMessage('Category is required'),
    body('technologies')
      .isArray()
      .withMessage('Technologies must be an array'),
  ],
};

// Public routes
router.get('/', getAllProjects);
router.get('/featured', getFeaturedProjects);
router.get('/categories', getCategories);
router.get('/slug/:slug', getProjectBySlug);
router.get('/:id', validate(commonValidations.mongoId('id')), getProject);
router.post('/:id/like', validate(commonValidations.mongoId('id')), likeProject);

// Admin only routes
router.post(
  '/',
  protect,
  restrictTo('admin'),
  validate(projectValidation.create),
  createProject
);
router.patch(
  '/:id',
  protect,
  restrictTo('admin'),
  validate(commonValidations.mongoId('id')),
  updateProject
);
router.delete(
  '/:id',
  protect,
  restrictTo('admin'),
  validate(commonValidations.mongoId('id')),
  deleteProject
);

export default router;
