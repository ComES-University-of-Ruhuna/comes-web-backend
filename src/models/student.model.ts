// ============================================
// ComES Backend - Student Model
// ============================================

import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import validator from 'validator';

export interface IStudent extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  password: string;
  username: string;
  registrationNo: string;
  batch: string;
  semester?: number;
  contactNo?: string;
  avatar?: string;
  bio?: string;
  skills?: string[];
  github?: string;
  linkedin?: string;
  website?: string;
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  registeredEvents: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  createEmailVerificationToken(): string;
  createPasswordResetToken(): string;
}

const studentSchema = new Schema<IStudent>(
  {
    name: {
      type: String,
      required: [true, 'Please provide your name'],
      trim: true,
      maxlength: [100, 'Name cannot be more than 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Please provide your email'],
      unique: true,
      lowercase: true,
      validate: [validator.isEmail, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    username: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9_-]+$/, 'Username can only contain lowercase letters, numbers, hyphens, and underscores'],
    },
    registrationNo: {
      type: String,
      required: [true, 'Please provide your registration number'],
      unique: true,
      validate: {
        validator: function (v: string) {
          return /^EG\/20(2[0-9]|[3-9][0-9])\/\d{4}$/.test(v);
        },
        message: 'Invalid registration number format. Use EG/20XX/XXXX',
      },
    },
    batch: {
      type: String,
      required: false, // Auto-calculated from registrationNo in pre-save hook
    },
    semester: {
      type: Number,
      min: 1,
      max: 8,
    },
    contactNo: {
      type: String,
      validate: {
        validator: function (v: string) {
          return !v || /^(\+94|0)?[0-9]{9,10}$/.test(v);
        },
        message: 'Please provide a valid phone number',
      },
    },
    avatar: String,
    bio: {
      type: String,
      maxlength: [500, 'Bio cannot be more than 500 characters'],
    },
    skills: [{
      type: String,
      trim: true,
    }],
    github: {
      type: String,
      validate: {
        validator: function (v: string) {
          return !v || /^https?:\/\/(www\.)?github\.com\/[a-zA-Z0-9_-]+\/?$/.test(v);
        },
        message: 'Please provide a valid GitHub profile URL',
      },
    },
    linkedin: {
      type: String,
      validate: {
        validator: function (v: string) {
          return !v || /^https?:\/\/(www\.)?linkedin\.com\/(in|pub)\/[a-zA-Z0-9_-]+\/?$/.test(v);
        },
        message: 'Please provide a valid LinkedIn profile URL',
      },
    },
    website: {
      type: String,
      validate: {
        validator: function (v: string) {
          return !v || validator.isURL(v);
        },
        message: 'Please provide a valid website URL',
      },
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    registeredEvents: [{
      type: Schema.Types.ObjectId,
      ref: 'Event',
    }],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Index for better query performance
studentSchema.index({ email: 1, registrationNo: 1 });
studentSchema.index({ batch: 1 });
studentSchema.index({ username: 1 });

// Pre-save middleware to hash password
studentSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Pre-save middleware to extract batch from registration number
studentSchema.pre('save', function (next) {
  if (this.isModified('registrationNo')) {
    const match = this.registrationNo.match(/EG\/(\d{4})\//);
    if (match) {
      this.batch = match[1];
    }
  }
  next();
});

// Pre-save middleware to generate default username if not provided
studentSchema.pre('save', async function (next) {
  if (!this.username && this.registrationNo) {
    // Convert EG/2024/1234 to eg_2024_1234
    const defaultUsername = this.registrationNo
      .toLowerCase()
      .replace(/\//g, '_');
    
    this.username = defaultUsername;
  }
  next();
});

// Method to compare passwords
studentSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to create email verification token
studentSchema.methods.createEmailVerificationToken = function (): string {
  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
  
  this.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  
  return token;
};

// Method to create password reset token
studentSchema.methods.createPasswordResetToken = function (): string {
  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
  
  this.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  
  return token;
};

export const Student = mongoose.model<IStudent>('Student', studentSchema);
