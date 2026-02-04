// ============================================
// ComES Backend - Newsletter Routes
// ============================================

import { Router } from 'express';
import {
  subscribe,
  unsubscribe,
  getAllSubscribers,
  deleteSubscriber,
  exportSubscribers,
} from '../controllers/newsletter.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';
import { validate, newsletterValidations, commonValidations } from '../middleware/validation.middleware';

const router = Router();

// Public routes
router.post('/subscribe', validate(newsletterValidations.subscribe), subscribe);
router.post('/unsubscribe', unsubscribe);

// Admin only routes
router.use(protect, restrictTo('admin'));

router.get('/', getAllSubscribers);
router.get('/export', exportSubscribers);
router.delete('/:id', validate(commonValidations.mongoId('id')), deleteSubscriber);

export default router;
