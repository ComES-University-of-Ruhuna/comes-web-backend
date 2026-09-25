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
import { protect, restrictTo } from '../middleware/auth.middleware';
import { validate, eventValidations, commonValidations } from '../middleware/validation.middleware';
import { getPublicEventCommittee, getEventCommittee, searchCommitteeMembers, saveCommitteeMember, removeCommitteeMember, updateMemberContributions, uploadEventImage } from '../controllers/eventCommittee.controller';
import { committeeEventId, committeeMemberId, committeeAssignment, committeeContributions } from '../middleware/eventCommittee.validation';

const router = Router();

router.get('/committee-members', protect, restrictTo('admin'), searchCommitteeMembers);
router.get('/:id/committee', protect, restrictTo('admin'), validate(committeeEventId), getEventCommittee);
router.put('/:id/committee/:memberId', protect, restrictTo('admin'), validate(committeeAssignment), saveCommitteeMember);
router.delete('/:id/committee/:memberId', protect, restrictTo('admin'), validate(committeeMemberId), removeCommitteeMember);
router.patch('/:id/committee/:memberId/contributions', protect, restrictTo('admin'), validate(committeeContributions), updateMemberContributions);

// Public routes
router.get('/', getAllEvents);
router.get('/featured', getFeaturedEvents);
router.get('/slug/:slug', getEventBySlug);
router.get('/:id/organizers', validate(committeeEventId), getPublicEventCommittee);
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
router.post('/image', protect, restrictTo('admin'), uploadEventImage);
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
