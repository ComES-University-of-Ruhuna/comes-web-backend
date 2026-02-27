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
import { validate, quizValidations, commonValidations } from '../middleware/validation.middleware';

const router = Router();

// Quiz CRUD - All public (no auth)
router.get('/', getAllQuizzes);
router.get('/:id', validate(commonValidations.mongoId('id')), getQuizById);
router.post('/', validate(quizValidations.create), createQuiz);
router.patch(
    '/:id',
    validate([...commonValidations.mongoId('id'), ...quizValidations.update]),
    updateQuiz
);
router.delete(
    '/:id',
    validate(commonValidations.mongoId('id')),
    deleteQuiz
);

// Visibility toggle
router.patch(
    '/:id/visibility',
    validate([...commonValidations.mongoId('id'), ...quizValidations.toggleVisibility]),
    toggleVisibility
);

// Quiz attempts
router.post(
    '/:id/attempt',
    validate([...commonValidations.mongoId('id'), ...quizValidations.submitAttempt]),
    submitQuizAttempt
);
router.get(
    '/:id/attempts',
    validate(commonValidations.mongoId('id')),
    getQuizAttempts
);

export default router;
