// ============================================
// ComES Backend - Quiz Controller
// ============================================

import { Request, Response } from 'express';
import { Quiz } from '../models/quiz.model';
import { QuizAttempt } from '../models/quizAttempt.model';
import { asyncHandler, NotFoundError, AppError } from '../utils';

/**
 * @desc    Create a new quiz
 * @route   POST /api/v1/quizzes
 * @access  Public
 */
export const createQuiz = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
        const quiz = await Quiz.create(req.body);

        res.status(201).json({
            success: true,
            message: 'Quiz created successfully',
            data: {
                quiz,
            },
        });
    }
);

/**
 * @desc    Get all visible quizzes
 * @route   GET /api/v1/quizzes
 * @access  Public
 */
export const getAllQuizzes = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        const filter: Record<string, unknown> = {};

        // Only show visible quizzes by default
        if (req.query.includeHidden !== 'true' || req.user?.role !== 'admin') {
            filter.isVisible = true;
        }

        // Search by title or description
        if (req.query.search) {
            filter.$or = [
                { title: { $regex: req.query.search, $options: 'i' } },
                { description: { $regex: req.query.search, $options: 'i' } },
            ];
        }

        // Sorting
        let sort: Record<string, 1 | -1> = { createdAt: -1 };
        if (req.query.sort) {
            const sortField = (req.query.sort as string).replace('-', '');
            const sortOrder = (req.query.sort as string).startsWith('-') ? -1 : 1;
            sort = { [sortField]: sortOrder };
        }

        const [quizzes, total] = await Promise.all([
            Quiz.find(filter)
                .select(req.user?.role === 'admin' ? '' : '-questions.answers.isCorrect')
                .skip(skip)
                .limit(limit)
                .sort(sort),
            Quiz.countDocuments(filter),
        ]);

        res.set('X-Total-Count', total.toString());

        res.status(200).json({
            success: true,
            data: {
                quizzes,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                },
            },
        });
    }
);

/**
 * @desc    Get quiz by ID
 * @route   GET /api/v1/quizzes/:id
 * @access  Public
 */
export const getQuizById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
        const isAdmin = req.user?.role === 'admin';
        const quiz = await Quiz.findById(req.params.id)
            .select(isAdmin ? '' : '-questions.answers.isCorrect');

        if (!quiz || (!quiz.isVisible && !isAdmin)) {
            throw new NotFoundError('Quiz');
        }

        res.status(200).json({
            success: true,
            data: {
                quiz,
            },
        });
    }
);

/**
 * @desc    Update quiz
 * @route   PATCH /api/v1/quizzes/:id
 * @access  Public
 */
export const updateQuiz = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
        const quiz = await Quiz.findById(req.params.id);

        if (!quiz) {
            throw new NotFoundError('Quiz');
        }

        // Update fields
        const allowedFields = ['title', 'description', 'questions', 'isVisible'];
        allowedFields.forEach((field) => {
            if (req.body[field] !== undefined) {
                quiz.set(field, req.body[field]);
            }
        });

        await quiz.save();

        res.status(200).json({
            success: true,
            message: 'Quiz updated successfully',
            data: {
                quiz,
            },
        });
    }
);

/**
 * @desc    Delete quiz
 * @route   DELETE /api/v1/quizzes/:id
 * @access  Public
 */
export const deleteQuiz = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
        const quiz = await Quiz.findByIdAndDelete(req.params.id);

        if (!quiz) {
            throw new NotFoundError('Quiz');
        }

        // Also delete all attempts for this quiz
        await QuizAttempt.deleteMany({ quizId: req.params.id });

        res.status(200).json({
            success: true,
            message: 'Quiz deleted successfully',
            data: null,
        });
    }
);

/**
 * @desc    Toggle quiz visibility
 * @route   PATCH /api/v1/quizzes/:id/visibility
 * @access  Public
 */
export const toggleVisibility = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
        const quiz = await Quiz.findById(req.params.id);

        if (!quiz) {
            throw new NotFoundError('Quiz');
        }

        // If isVisible is provided in body, use it; otherwise toggle
        if (req.body.isVisible !== undefined) {
            quiz.isVisible = req.body.isVisible;
        } else {
            quiz.isVisible = !quiz.isVisible;
        }

        await quiz.save();

        res.status(200).json({
            success: true,
            message: `Quiz is now ${quiz.isVisible ? 'visible' : 'hidden'}`,
            data: {
                quiz,
            },
        });
    }
);

/**
 * @desc    Submit a quiz attempt
 * @route   POST /api/v1/quizzes/:id/attempt
 * @access  Public
 */
export const submitQuizAttempt = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
        const quiz = await Quiz.findById(req.params.id);

        if (!quiz) {
            throw new NotFoundError('Quiz');
        }

        if (!quiz.isVisible) {
            throw new AppError('This quiz is not available', 403);
        }

        const { responses } = req.body;

        if (!responses || !Array.isArray(responses)) {
            throw new AppError('Responses are required', 400);
        }

        // Use authenticated student info
        const participantName = req.student!.name;
        const studentId = req.student!._id;

        // Build a map of questions for quick lookup
        const questionMap = new Map(
            quiz.questions.map((q) => [q._id.toString(), q])
        );

        // Calculate scores for each response
        const answeredQuestions = new Set<string>();
        const scoredResponses = responses.map((response: unknown) => {
            if (!response || typeof response !== 'object' ||
                !('questionId' in response) || typeof response.questionId !== 'string' ||
                !('selectedAnswerIndex' in response) || typeof response.selectedAnswerIndex !== 'number' ||
                !('responseTimeSeconds' in response) || typeof response.responseTimeSeconds !== 'number') {
                throw new AppError('Invalid quiz response', 400);
            }

            const question = questionMap.get(response.questionId);

            if (!question) {
                throw new AppError(`Question ${response.questionId} not found in this quiz`, 400);
            }

            const selectedIndex = response.selectedAnswerIndex;
            const responseTime = response.responseTimeSeconds;

            if (answeredQuestions.has(response.questionId)) {
                throw new AppError('Each question may only be answered once', 400);
            }
            if (!Number.isInteger(selectedIndex) || selectedIndex < -1 || selectedIndex >= question.answers.length ||
                !Number.isFinite(responseTime) || responseTime < 0) {
                throw new AppError('Invalid answer index or response time', 400);
            }
            answeredQuestions.add(response.questionId);

            // Check if the answer is correct
            const isCorrect = question.answers[selectedIndex]?.isCorrect || false;

            // Calculate marks based on response time
            let marksAwarded = 0;
            if (isCorrect) {
                const timeLimit = question.timeLimitSeconds;
                const timeFraction = Math.max(0, (timeLimit - responseTime) / timeLimit);
                // Minimum 10% of marks for a correct answer, even if slow
                marksAwarded = Math.max(
                    question.marks * 0.1,
                    question.marks * timeFraction
                );
                // Round to 2 decimal places
                marksAwarded = Math.round(marksAwarded * 100) / 100;
            }

            return {
                questionId: response.questionId,
                selectedAnswerIndex: selectedIndex,
                responseTimeSeconds: responseTime,
                isCorrect,
                marksAwarded,
            };
        });

        // Calculate totals
        const totalMarks = scoredResponses.reduce(
            (sum, response) => sum + response.marksAwarded,
            0
        );
        const maxMarks = quiz.questions.reduce((sum, q) => sum + q.marks, 0);
        const percentage = maxMarks > 0 ? Math.round((totalMarks / maxMarks) * 10000) / 100 : 0;

        // Create the attempt
        const attempt = await QuizAttempt.create({
            quizId: quiz._id,
            studentId,
            participantName,
            responses: scoredResponses,
            totalMarks: Math.round(totalMarks * 100) / 100,
            maxMarks,
            percentage,
            completedAt: new Date(),
        });

        res.status(201).json({
            success: true,
            message: 'Quiz attempt submitted successfully',
            data: {
                attempt,
            },
        });
    }
);

/**
 * @desc    Get all attempts for a quiz
 * @route   GET /api/v1/quizzes/:id/attempts
 * @access  Public
 */
export const getQuizAttempts = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
        const quiz = await Quiz.findById(req.params.id);

        if (!quiz) {
            throw new NotFoundError('Quiz');
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        // Sorting: by default, highest marks first
        let sort: Record<string, 1 | -1> = { totalMarks: -1 };
        if (req.query.sort === 'recent') {
            sort = { completedAt: -1 };
        }

        const [attempts, total] = await Promise.all([
            QuizAttempt.find({ quizId: req.params.id })
                .skip(skip)
                .limit(limit)
                .sort(sort),
            QuizAttempt.countDocuments({ quizId: req.params.id }),
        ]);

        res.set('X-Total-Count', total.toString());

        res.status(200).json({
            success: true,
            data: {
                attempts,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                },
            },
        });
    }
);
