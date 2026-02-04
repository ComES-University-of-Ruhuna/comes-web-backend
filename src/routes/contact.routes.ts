// ============================================
// ComES Backend - Contact Routes
// ============================================

import { Router } from 'express';
import {
  submitContact,
  getAllContacts,
  getContact,
  replyToContact,
  updateContact,
  deleteContact,
} from '../controllers/contact.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';
import { validate, contactValidations, commonValidations } from '../middleware/validation.middleware';
import { body } from 'express-validator';

const router = Router();

// Public routes
router.post('/', validate(contactValidations.submit), submitContact);

// Admin only routes
router.use(protect, restrictTo('admin'));

router.get('/', getAllContacts);
router.get('/:id', validate(commonValidations.mongoId('id')), getContact);
router.post(
  '/:id/reply',
  validate([
    ...commonValidations.mongoId('id'),
    body('message')
      .trim()
      .isLength({ min: 10 })
      .withMessage('Reply message must be at least 10 characters'),
  ]),
  replyToContact
);
router.patch('/:id', validate(commonValidations.mongoId('id')), updateContact);
router.delete('/:id', validate(commonValidations.mongoId('id')), deleteContact);

export default router;
