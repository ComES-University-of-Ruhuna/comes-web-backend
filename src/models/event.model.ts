// ============================================
// ComES Backend - Event Model
// ============================================

import mongoose, { Document, Schema } from 'mongoose';
import slugify from 'slugify';

export interface IEvent extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  slug: string;
  description: string;
  shortDescription?: string;
  date: Date;
  endDate?: Date;
  location: string;
  type: 'workshop' | 'hackathon' | 'seminar' | 'competition' | 'social' | 'other';
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  image?: string;
  icon?: string;
  maxParticipants?: number;
  registeredCount: number;
  registrations: mongoose.Types.ObjectId[];
  tags: string[];
  isFeatured: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const eventSchema = new Schema<IEvent>(
  {
    title: {
      type: String,
      required: [true, 'Event title is required'],
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
      required: [true, 'Event description is required'],
      minlength: [10, 'Description must be at least 10 characters'],
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
    },
    shortDescription: {
      type: String,
      maxlength: [300, 'Short description cannot exceed 300 characters'],
    },
    date: {
      type: Date,
      required: [true, 'Event date is required'],
    },
    endDate: {
      type: Date,
    },
    location: {
      type: String,
      required: [true, 'Event location is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['workshop', 'hackathon', 'seminar', 'competition', 'social', 'other'],
      default: 'other',
    },
    status: {
      type: String,
      enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
      default: 'upcoming',
    },
    image: String,
    icon: String,
    maxParticipants: {
      type: Number,
      min: [1, 'Max participants must be at least 1'],
    },
    registeredCount: {
      type: Number,
      default: 0,
    },
    registrations: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    tags: [String],
    isFeatured: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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

eventSchema.index({ slug: 1 });
eventSchema.index({ date: 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ type: 1 });
eventSchema.index({ isFeatured: 1 });
eventSchema.index({ createdAt: -1 });

// ============================================
// Virtual Fields
// ============================================

eventSchema.virtual('isRegistrationOpen').get(function (this: IEvent): boolean {
  if (this.status !== 'upcoming') return false;
  if (!this.maxParticipants) return true;
  return this.registeredCount < this.maxParticipants;
});

eventSchema.virtual('availableSpots').get(function (this: IEvent): number | null {
  if (!this.maxParticipants) return null;
  return Math.max(0, this.maxParticipants - this.registeredCount);
});

// ============================================
// Pre-save Middleware
// ============================================

eventSchema.pre<IEvent>('save', function (next) {
  if (this.isModified('title')) {
    this.slug = slugify(this.title, { lower: true, strict: true });
  }
  
  // Auto-generate short description if not provided
  if (!this.shortDescription && this.description) {
    this.shortDescription = this.description.substring(0, 150) + '...';
  }

  next();
});

// Auto-update status based on date
eventSchema.pre<IEvent>('save', function (next) {
  const now = new Date();
  
  if (this.status !== 'cancelled') {
    if (this.endDate && now > this.endDate) {
      this.status = 'completed';
    } else if (now >= this.date && (!this.endDate || now <= this.endDate)) {
      this.status = 'ongoing';
    } else if (now < this.date) {
      this.status = 'upcoming';
    }
  }

  next();
});

export const Event = mongoose.model<IEvent>('Event', eventSchema);

export default Event;
