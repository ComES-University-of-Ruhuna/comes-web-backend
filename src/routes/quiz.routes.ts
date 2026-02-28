// ============================================
// ComES Backend - Quiz Routes
// ============================================

import { Router } from 'express';
import {
    createQuiz,
    getAllQuizzes,
    getQuizById,
    updateQuiz,
    deleteQuiz,
    toggleVisibility,
    submitQuizAttempt,
    getQuizAttempts,
} from '../controllers/quiz.controller';
import { protect, restrictTo, protectStudent } from '../middleware/auth.middleware';
import { validate, quizValidations, commonValidations } from '../middleware/validation.middleware';

const router = Router();

// Public routes - anyone can browse quizzes
router.get('/', getAllQuizzes);
router.get('/:id', validate(commonValidations.mongoId('id')), getQuizById);

// Admin only routes - quiz management
router.post(
    '/',
    protect,
    restrictTo('admin'),
    validate(quizValidations.create),
    createQuiz
);
router.patch(
    '/:id',
    protect,
    restrictTo('admin'),
    validate([...commonValidations.mongoId('id'), ...quizValidations.update]),
    updateQuiz
);
router.delete(
    '/:id',
    protect,
    restrictTo('admin'),
    validate(commonValidations.mongoId('id')),
    deleteQuiz
);
router.patch(
    '/:id/visibility',
    protect,
    restrictTo('admin'),
    validate([...commonValidations.mongoId('id'), ...quizValidations.toggleVisibility]),
    toggleVisibility
);
router.get(
    '/:id/attempts',
    protect,
    restrictTo('admin'),
    validate(commonValidations.mongoId('id')),
    getQuizAttempts
);

// Student only routes - quiz taking
router.post(
    '/:id/attempt',
    protectStudent,
    validate([...commonValidations.mongoId('id'), ...quizValidations.submitAttempt]),
    submitQuizAttempt
);

export default router;
