// ============================================
// ComES Backend - Project Model
// ============================================

import mongoose, { Document, Schema } from 'mongoose';
import slugify from 'slugify';

export interface IProject extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  slug: string;
  description: string;
  shortDescription?: string;
  category: string;
  technologies: string[];
  image?: string;
  images: string[];
  demoUrl?: string;
  githubUrl?: string;
  status: 'in-progress' | 'completed' | 'archived';
  team: mongoose.Types.ObjectId[];
  teamLead?: mongoose.Types.ObjectId;
  startDate?: Date;
  endDate?: Date;
  isFeatured: boolean;
  likes: number;
  views: number;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>(
  {
    title: {
      type: String,
      required: [true, 'Project title is required'],
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
      required: [true, 'Project description is required'],
      minlength: [10, 'Description must be at least 10 characters'],
    },
    shortDescription: {
      type: String,
      maxlength: [300, 'Short description cannot exceed 300 characters'],
    },
    category: {
      type: String,
      required: [true, 'Project category is required'],
      trim: true,
    },
    technologies: [{
      type: String,
      trim: true,
    }],
    image: String,
    images: [String],
    demoUrl: {
      type: String,
      trim: true,
    },
    githubUrl: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['in-progress', 'completed', 'archived'],
      default: 'in-progress',
    },
    team: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    teamLead: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    startDate: Date,
    endDate: Date,
    isFeatured: {
      type: Boolean,
      default: false,
    },
    likes: {
      type: Number,
      default: 0,
    },
    views: {
      type: Number,
      default: 0,
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

projectSchema.index({ slug: 1 });
projectSchema.index({ category: 1 });
projectSchema.index({ status: 1 });
projectSchema.index({ isFeatured: 1 });
projectSchema.index({ technologies: 1 });
projectSchema.index({ createdAt: -1 });

// ============================================
// Pre-save Middleware
// ============================================

projectSchema.pre<IProject>('save', function (next) {
  if (this.isModified('title')) {
    this.slug = slugify(this.title, { lower: true, strict: true });
  }

  if (!this.shortDescription && this.description) {
    this.shortDescription = this.description.substring(0, 150) + '...';
  }

  next();
});

export const Project = mongoose.model<IProject>('Project', projectSchema);

export default Project;
