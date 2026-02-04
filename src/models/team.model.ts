// ============================================
// ComES Backend - Team Member Model
// ============================================

import mongoose, { Document, Schema } from 'mongoose';

export interface ITeamMember extends Document {
  _id: mongoose.Types.ObjectId;
  user?: mongoose.Types.ObjectId;
  name: string;
  email?: string;
  role: string;
  department: string;
  batch: string;
  avatar?: string;
  bio?: string;
  linkedin?: string;
  github?: string;
  twitter?: string;
  order: number;
  isActive: boolean;
  term: {
    start: Date;
    end?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const teamMemberSchema = new Schema<ITeamMember>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    role: {
      type: String,
      required: [true, 'Role is required'],
      trim: true,
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      enum: ['executive', 'technical', 'creative', 'marketing', 'events', 'finance', 'advisory'],
    },
    batch: {
      type: String,
      required: [true, 'Batch is required'],
      trim: true,
    },
    avatar: String,
    bio: {
      type: String,
      maxlength: [500, 'Bio cannot exceed 500 characters'],
    },
    linkedin: String,
    github: String,
    twitter: String,
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    term: {
      start: {
        type: Date,
        required: true,
      },
      end: Date,
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

teamMemberSchema.index({ department: 1 });
teamMemberSchema.index({ isActive: 1 });
teamMemberSchema.index({ order: 1 });
teamMemberSchema.index({ 'term.start': -1 });

// ============================================
// Query Middleware
// ============================================

// Sort by order by default
teamMemberSchema.pre(/^find/, function (this: mongoose.Query<any, any>, next) {
  this.sort({ order: 1 });
  next();
});

export const TeamMember = mongoose.model<ITeamMember>('TeamMember', teamMemberSchema);

export default TeamMember;
