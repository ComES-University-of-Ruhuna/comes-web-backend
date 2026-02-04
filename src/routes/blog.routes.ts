// ============================================
// ComES Backend - Blog Routes
// ============================================

import { Router } from 'express';
import {
  getAllPosts,
  getFeaturedPosts,
  getCategories,
  getTags,
  getPost,
  getPostBySlug,
  createPost,
  updatePost,
  deletePost,
  likePost,
} from '../controllers/blog.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';
import { validate, commonValidations } from '../middleware/validation.middleware';
import { body } from 'express-validator';

const router = Router();

// Validation rules for blog posts
const blogValidation = {
  create: [
    body('title')
      .trim()
      .isLength({ min: 3, max: 200 })
      .withMessage('Title must be between 3 and 200 characters'),
    body('content')
      .trim()
      .isLength({ min: 50 })
      .withMessage('Content must be at least 50 characters'),
    body('category')
      .trim()
      .notEmpty()
      .withMessage('Category is required'),
    body('status')
      .optional()
      .isIn(['draft', 'published', 'archived'])
      .withMessage('Invalid status'),
  ],
};

// Public routes
router.get('/', getAllPosts);
router.get('/featured', getFeaturedPosts);
router.get('/categories', getCategories);
router.get('/tags', getTags);
router.get('/slug/:slug', getPostBySlug);
router.get('/:id', validate(commonValidations.mongoId('id')), getPost);
router.post('/:id/like', validate(commonValidations.mongoId('id')), likePost);

// Admin only routes
router.post(
  '/',
  protect,
  restrictTo('admin'),
  validate(blogValidation.create),
  createPost
);
router.patch(
  '/:id',
  protect,
  restrictTo('admin'),
  validate(commonValidations.mongoId('id')),
  updatePost
);
router.delete(
  '/:id',
  protect,
  restrictTo('admin'),
  validate(commonValidations.mongoId('id')),
  deletePost
);

export default router;
