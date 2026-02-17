// ============================================
// ComES Backend - Student Routes
// ============================================

import { Router } from 'express';
import {
  register,
  login,
  getProfile,
  updateProfile,
  verifyEmail,
  getAllStudents,
  searchStudents,
  changePassword,
  getMyEvents,
  registerForEvent,
  unregisterFromEvent,
  getStudentPortfolio,
  deleteAccount,
  deleteStudentByAdmin,
  sendNotificationToStudent,
  sendNotificationToAllStudents,
} from '../controllers/student.controller';
import { protect, restrictTo, protectStudent } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { body } from 'express-validator';

const router = Router();

// Validation rules
const studentValidation = {
  register: [
    body('name')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters'),
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
    body('passwordConfirm')
      .custom((value, { req }) => value === req.body.password)
      .withMessage('Passwords do not match'),
    body('registrationNo')
      .matches(/^EG\/20(2[0-9]|[3-9][0-9])\/\d{4}$/)
      .withMessage('Invalid registration number format. Use EG/20XX/XXXX'),
  ],
  login: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email'),
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
  ],
};

// Public routes
router.post('/register', validate(studentValidation.register), register);
router.post('/login', validate(studentValidation.login), login);
router.get('/verify-email/:token', verifyEmail);
router.get('/portfolio/:username', getStudentPortfolio);

// Admin routes (must be before protectStudent middleware)
router.get('/', protect, restrictTo('admin'), getAllStudents);
router.delete('/:id', protect, restrictTo('admin'), deleteStudentByAdmin);
router.post('/notify', protect, restrictTo('admin'), sendNotificationToStudent);
router.post('/notify-all', protect, restrictTo('admin'), sendNotificationToAllStudents);

// Student authenticated routes
router.use(protectStudent);

router.get('/me', getProfile);
router.patch('/me', updateProfile);
router.delete('/me', deleteAccount);
router.post('/change-password', changePassword);
router.get('/my-events', getMyEvents);
router.post('/events/:eventId/register', registerForEvent);
router.delete('/events/:eventId/unregister', unregisterFromEvent);
router.get('/search', searchStudents);

export default router;
