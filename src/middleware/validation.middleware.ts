// ============================================
// ComES Backend - Validation Middleware
// ============================================

import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain, body, param, query } from 'express-validator';
import { ValidationError } from '../utils/errors';

/**
 * Middleware to handle validation results
 */
export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Run all validations
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);
    
    if (errors.isEmpty()) {
      return next();
    }

    // Format errors
    const formattedErrors: Record<string, string> = {};
    errors.array().forEach((error) => {
      if (error.type === 'field') {
        formattedErrors[error.path] = error.msg;
      }
    });

    throw new ValidationError('Validation failed', formattedErrors);
  };
};

// ============================================
// Common Validation Rules
// ============================================

export const commonValidations = {
  // Pagination
  pagination: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
  ],

  // MongoDB ObjectId
  mongoId: (field: string = 'id') => [
    param(field)
      .isMongoId()
      .withMessage('Invalid ID format'),
  ],

  // Email
  email: (field: string = 'email') => [
    body(field)
      .trim()
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
  ],

  // Password
  password: (field: string = 'password') => [
    body(field)
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  ],

  // Name
  name: (field: string = 'name') => [
    body(field)
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters'),
  ],
};

// ============================================
// Auth Validations
// ============================================

export const authValidations = {
  register: [
    ...commonValidations.name('name'),
    ...commonValidations.email('email'),
    ...commonValidations.password('password'),
    body('passwordConfirm')
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Passwords do not match');
        }
        return true;
      }),
    body('studentId')
      .optional()
      .trim()
      .matches(/^EG\/\d{4}\/\d{4}$/)
      .withMessage('Invalid student ID format (e.g., EG/2020/1234)'),
  ],

  login: [
    ...commonValidations.email('email'),
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
  ],

  forgotPassword: [
    ...commonValidations.email('email'),
  ],

  resetPassword: [
    ...commonValidations.password('password'),
    body('passwordConfirm')
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Passwords do not match');
        }
        return true;
      }),
  ],

  updatePassword: [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    ...commonValidations.password('password'),
    body('passwordConfirm')
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Passwords do not match');
        }
        return true;
      }),
  ],
};

// ============================================
// User Validations
// ============================================

export const userValidations = {
  updateProfile: [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters'),
    body('bio')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Bio must not exceed 500 characters'),
    body('linkedin')
      .optional()
      .trim()
      .isURL()
      .withMessage('Invalid LinkedIn URL'),
    body('github')
      .optional()
      .trim()
      .isURL()
      .withMessage('Invalid GitHub URL'),
  ],
};

// ============================================
// Event Validations
// ============================================

export const eventValidations = {
  create: [
    body('title')
      .trim()
      .isLength({ min: 3, max: 200 })
      .withMessage('Title must be between 3 and 200 characters'),
    body('description')
      .trim()
      .isLength({ min: 10, max: 5000 })
      .withMessage('Description must be between 10 and 5000 characters'),
    body('date')
      .isISO8601()
      .withMessage('Invalid date format'),
    body('location')
      .trim()
      .isLength({ min: 2, max: 200 })
      .withMessage('Location must be between 2 and 200 characters'),
    body('type')
      .isIn(['workshop', 'hackathon', 'seminar', 'competition', 'social', 'other'])
      .withMessage('Invalid event type'),
    body('maxParticipants')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Max participants must be a positive integer'),
  ],

  update: [
    body('title')
      .optional()
      .trim()
      .isLength({ min: 3, max: 200 })
      .withMessage('Title must be between 3 and 200 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ min: 10, max: 5000 })
      .withMessage('Description must be between 10 and 5000 characters'),
    body('date')
      .optional()
      .isISO8601()
      .withMessage('Invalid date format'),
    body('status')
      .optional()
      .isIn(['upcoming', 'ongoing', 'completed', 'cancelled'])
      .withMessage('Invalid status'),
  ],
};

// ============================================
// Contact Validations
// ============================================

export const contactValidations = {
  submit: [
    ...commonValidations.name('name'),
    ...commonValidations.email('email'),
    body('subject')
      .trim()
      .isLength({ min: 3, max: 200 })
      .withMessage('Subject must be between 3 and 200 characters'),
    body('message')
      .trim()
      .isLength({ min: 10, max: 5000 })
      .withMessage('Message must be between 10 and 5000 characters'),
  ],
};

// ============================================
// Newsletter Validations
// ============================================

export const newsletterValidations = {
  subscribe: [
    ...commonValidations.email('email'),
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters'),
  ],
};
