// ============================================
// ComES Backend - Quiz Model
// ============================================

import mongoose, { Document, Schema } from 'mongoose';
import slugify from 'slugify';

// ============================================
// Interfaces
// ============================================

export interface IAnswer {
  text: string;
  isCorrect: boolean;
}

export interface IQuestion {
  _id: mongoose.Types.ObjectId;
  questionText: string;
  imageUrl?: string;
  answers: IAnswer[];
  timeLimitSeconds: number;
  marks: number;
}

export interface IQuiz extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  slug: string;
  description?: string;
  questions: IQuestion[];
  totalMarks: number;
  isVisible: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Sub-schemas
// ============================================

const answerSchema = new Schema<IAnswer>(
  {
    text: {
      type: String,
      required: [true, 'Answer text is required'],
      trim: true,
      maxlength: [500, 'Answer text cannot exceed 500 characters'],
    },
    isCorrect: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const questionSchema = new Schema<IQuestion>({
  questionText: {
    type: String,
    required: [true, 'Question text is required'],
    trim: true,
    maxlength: [1000, 'Question text cannot exceed 1000 characters'],
  },
  imageUrl: {
    type: String,
    trim: true,
  },
  answers: {
    type: [answerSchema],
    validate: [
      {
        validator: (val: IAnswer[]) => val.length === 4,
        message: 'Each question must have exactly 4 answers',
      },
      {
        validator: (val: IAnswer[]) => val.some((a) => a.isCorrect),
        message: 'Each question must have at least one correct answer',
      },
    ],
  },
  timeLimitSeconds: {
    type: Number,
    required: [true, 'Time limit is required'],
    min: [5, 'Time limit must be at least 5 seconds'],
    max: [300, 'Time limit cannot exceed 300 seconds'],
  },
  marks: {
    type: Number,
    required: [true, 'Marks for the question are required'],
    min: [1, 'Marks must be at least 1'],
  },
});

// ============================================
// Quiz Schema
// ============================================

const quizSchema = new Schema<IQuiz>(
  {
    title: {
      type: String,
      required: [true, 'Quiz title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    slug: {
      type: String,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    questions: {
      type: [questionSchema],
      validate: {
        validator: (val: IQuestion[]) => val.length >= 1,
        message: 'Quiz must have at least one question',
      },
    },
    isVisible: {
      type: Boolean,
      default: true,
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

quizSchema.index({ slug: 1 });
quizSchema.index({ isVisible: 1 });
quizSchema.index({ createdAt: -1 });

// ============================================
// Virtual Fields
// ============================================

quizSchema.virtual('totalMarks').get(function (this: IQuiz): number {
  if (!this.questions || this.questions.length === 0) return 0;
  return this.questions.reduce((sum, q) => sum + q.marks, 0);
});

// ============================================
// Pre-save Middleware
// ============================================

quizSchema.pre<IQuiz>('save', function (next) {
  if (this.isModified('title')) {
    this.slug = slugify(this.title, { lower: true, strict: true });
  }
  next();
});

export const Quiz = mongoose.model<IQuiz>('Quiz', quizSchema);

export default Quiz;
