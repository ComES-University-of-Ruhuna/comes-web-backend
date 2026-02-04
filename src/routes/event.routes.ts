// ============================================
// ComES Backend - Event Routes
// ============================================

import { Router } from 'express';
import {
  getAllEvents,
  getFeaturedEvents,
  getEvent,
  getEventBySlug,
  createEvent,
  updateEvent,
  deleteEvent,
  registerForEvent,
  unregisterFromEvent,
} from '../controllers/event.controller';
import { protect, restrictTo, optionalAuth } from '../middleware/auth.middleware';
import { validate, eventValidations, commonValidations } from '../middleware/validation.middleware';

const router = Router();

// Public routes
router.get('/', getAllEvents);
router.get('/featured', getFeaturedEvents);
router.get('/slug/:slug', getEventBySlug);
router.get('/:id', validate(commonValidations.mongoId('id')), getEvent);

// Protected routes
router.post(
  '/:id/register',
  protect,
  validate(commonValidations.mongoId('id')),
  registerForEvent
);
router.delete(
  '/:id/register',
  protect,
  validate(commonValidations.mongoId('id')),
  unregisterFromEvent
);

// Admin only routes
router.post(
  '/',
  protect,
  restrictTo('admin'),
  validate(eventValidations.create),
  createEvent
);
router.patch(
  '/:id',
  protect,
  restrictTo('admin'),
  validate([...commonValidations.mongoId('id'), ...eventValidations.update]),
  updateEvent
);
router.delete(
  '/:id',
  protect,
  restrictTo('admin'),
  validate(commonValidations.mongoId('id')),
  deleteEvent
);

export default router;
