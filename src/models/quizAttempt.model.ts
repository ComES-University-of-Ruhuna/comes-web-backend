// ============================================
// ComES Backend - Quiz Attempt Model
// ============================================

import mongoose, { Document, Schema } from 'mongoose';

// ============================================
// Interfaces
// ============================================

export interface IQuestionResponse {
    questionId: mongoose.Types.ObjectId;
    selectedAnswerIndex: number;
    responseTimeSeconds: number;
    isCorrect: boolean;
    marksAwarded: number;
}

export interface IQuizAttempt extends Document {
    _id: mongoose.Types.ObjectId;
    quizId: mongoose.Types.ObjectId;
    participantName: string;
    responses: IQuestionResponse[];
    totalMarks: number;
    maxMarks: number;
    percentage: number;
    completedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

// ============================================
// Sub-schemas
// ============================================

const questionResponseSchema = new Schema<IQuestionResponse>(
    {
        questionId: {
            type: Schema.Types.ObjectId,
            required: [true, 'Question ID is required'],
        },
        selectedAnswerIndex: {
            type: Number,
            required: [true, 'Selected answer index is required'],
            min: [0, 'Answer index must be between 0 and 3'],
            max: [3, 'Answer index must be between 0 and 3'],
        },
        responseTimeSeconds: {
            type: Number,
            required: [true, 'Response time is required'],
            min: [0, 'Response time cannot be negative'],
        },
        isCorrect: {
            type: Boolean,
            default: false,
        },
        marksAwarded: {
            type: Number,
            default: 0,
            min: [0, 'Marks awarded cannot be negative'],
        },
    },
    { _id: false }
);

// ============================================
// Quiz Attempt Schema
// ============================================

const quizAttemptSchema = new Schema<IQuizAttempt>(
    {
        quizId: {
            type: Schema.Types.ObjectId,
            ref: 'Quiz',
            required: [true, 'Quiz ID is required'],
        },
        participantName: {
            type: String,
            required: [true, 'Participant name is required'],
            trim: true,
            minlength: [2, 'Name must be at least 2 characters'],
            maxlength: [100, 'Name cannot exceed 100 characters'],
        },
        responses: {
            type: [questionResponseSchema],
            required: [true, 'Responses are required'],
        },
        totalMarks: {
            type: Number,
            default: 0,
        },
        maxMarks: {
            type: Number,
            default: 0,
        },
        percentage: {
            type: Number,
            default: 0,
        },
        completedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// ============================================
// Indexes
// ============================================

quizAttemptSchema.index({ quizId: 1 });
quizAttemptSchema.index({ completedAt: -1 });
quizAttemptSchema.index({ totalMarks: -1 });

export const QuizAttempt = mongoose.model<IQuizAttempt>('QuizAttempt', quizAttemptSchema);

export default QuizAttempt;
