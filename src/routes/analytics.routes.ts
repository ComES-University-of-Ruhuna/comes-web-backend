// ============================================
// ComES Backend - Analytics Routes
// ============================================

import { Router } from 'express';
import {
  trackVisit,
  trackPageView,
  getAnalyticsSummary,
  getVisitors,
} from '../controllers/analytics.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';

const router = Router();

// Public routes (for tracking)
router.post('/visit', trackVisit);
router.post('/pageview', trackPageView);

// Admin routes
router.get('/summary', protect, restrictTo('admin'), getAnalyticsSummary);
router.get('/visitors', protect, restrictTo('admin'), getVisitors);

export default router;
