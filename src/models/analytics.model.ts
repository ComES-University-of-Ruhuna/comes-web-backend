// ============================================
// ComES Backend - Analytics Model
// ============================================

import mongoose, { Document, Schema } from 'mongoose';

export interface IPageView {
  path: string;
  title: string;
  timestamp: Date;
  duration: number;
}

export interface IVisitor extends Document {
  _id: mongoose.Types.ObjectId;
  sessionId: string;
  visitedAt: Date;
  pageViews: IPageView[];
  userAgent: string;
  screenResolution: string;
  language: string;
  referrer: string;
  country?: string;
  city?: string;
  device: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  os: string;
  duration: number;
  isReturning: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const pageViewSchema = new Schema<IPageView>(
  {
    path: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    duration: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const visitorSchema = new Schema<IVisitor>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    visitedAt: {
      type: Date,
      default: Date.now,
    },
    pageViews: [pageViewSchema],
    userAgent: String,
    screenResolution: String,
    language: String,
    referrer: {
      type: String,
      default: 'direct',
    },
    country: String,
    city: String,
    device: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet'],
      default: 'desktop',
    },
    browser: String,
    os: String,
    duration: {
      type: Number,
      default: 0,
    },
    isReturning: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Index for better query performance
visitorSchema.index({ visitedAt: -1 });
visitorSchema.index({ device: 1 });
visitorSchema.index({ browser: 1 });
visitorSchema.index({ referrer: 1 });

export const Visitor = mongoose.model<IVisitor>('Visitor', visitorSchema);
