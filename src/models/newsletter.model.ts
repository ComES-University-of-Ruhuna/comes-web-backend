// ============================================
// ComES Backend - Newsletter Subscriber Model
// ============================================

import mongoose, { Document, Schema } from 'mongoose';
import crypto from 'crypto';

export interface INewsletter extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  name?: string;
  isSubscribed: boolean;
  subscribedAt: Date;
  unsubscribedAt?: Date;
  unsubscribeToken: string;
  confirmationToken?: string;
  isConfirmed: boolean;
  confirmedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const newsletterSchema = new Schema<INewsletter>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    isSubscribed: {
      type: Boolean,
      default: true,
    },
    subscribedAt: {
      type: Date,
      default: Date.now,
    },
    unsubscribedAt: Date,
    unsubscribeToken: {
      type: String,
      unique: true,
    },
    confirmationToken: String,
    isConfirmed: {
      type: Boolean,
      default: false,
    },
    confirmedAt: Date,
  },
  {
    timestamps: true,
  }
);

// ============================================
// Indexes
// ============================================

newsletterSchema.index({ email: 1 });
newsletterSchema.index({ isSubscribed: 1 });
newsletterSchema.index({ unsubscribeToken: 1 });

// ============================================
// Pre-save Middleware
// ============================================

newsletterSchema.pre<INewsletter>('save', function (next) {
  if (this.isNew) {
    // Generate unsubscribe token
    this.unsubscribeToken = crypto.randomBytes(32).toString('hex');
    
    // Generate confirmation token
    this.confirmationToken = crypto.randomBytes(32).toString('hex');
  }

  next();
});

export const Newsletter = mongoose.model<INewsletter>('Newsletter', newsletterSchema);

export default Newsletter;
