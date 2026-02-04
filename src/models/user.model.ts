// ============================================
// ComES Backend - User Model
// ============================================

import mongoose, { Document, Schema, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import validator from 'validator';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  password: string;
  passwordConfirm?: string;
  role: 'user' | 'member' | 'admin';
  studentId?: string;
  avatar?: string;
  bio?: string;
  linkedin?: string;
  github?: string;
  isActive: boolean;
  isEmailVerified: boolean;
  passwordChangedAt?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  refreshToken?: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  correctPassword(candidatePassword: string, userPassword: string): Promise<boolean>;
  changedPasswordAfter(JWTTimestamp: number): boolean;
  createPasswordResetToken(): string;
  createEmailVerificationToken(): string;
}

interface IUserModel extends Model<IUser> {
  // Static methods can be added here
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Please provide your name'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Please provide your email'],
      unique: true,
      lowercase: true,
      trim: true,
      validate: [validator.isEmail, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Don't include password in queries by default
    },
    passwordConfirm: {
      type: String,
      required: [true, 'Please confirm your password'],
      validate: {
        // This only works on CREATE and SAVE
        validator: function (this: IUser, el: string): boolean {
          return el === this.password;
        },
        message: 'Passwords do not match',
      },
    },
    role: {
      type: String,
      enum: ['user', 'member', 'admin'],
      default: 'user',
    },
    studentId: {
      type: String,
      trim: true,
      unique: true,
      sparse: true, // Allow null values while maintaining uniqueness
      match: [/^EG\/\d{4}\/\d{4}$/, 'Invalid student ID format (e.g., EG/2020/1234)'],
    },
    avatar: {
      type: String,
      default: '',
    },
    bio: {
      type: String,
      maxlength: [500, 'Bio cannot exceed 500 characters'],
    },
    linkedin: {
      type: String,
      validate: {
        validator: function (v: string): boolean {
          return !v || validator.isURL(v);
        },
        message: 'Invalid LinkedIn URL',
      },
    },
    github: {
      type: String,
      validate: {
        validator: function (v: string): boolean {
          return !v || validator.isURL(v);
        },
        message: 'Invalid GitHub URL',
      },
    },
    isActive: {
      type: Boolean,
      default: true,
      select: false,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    refreshToken: {
      type: String,
      select: false,
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

userSchema.index({ email: 1 });
userSchema.index({ studentId: 1 });
userSchema.index({ role: 1 });

// ============================================
// Pre-save Middleware
// ============================================

// Hash password before saving
userSchema.pre<IUser>('save', async function (next) {
  // Only run if password was modified
  if (!this.isModified('password')) return next();

  // Hash the password with cost of 12
  this.password = await bcrypt.hash(this.password, 12);

  // Delete passwordConfirm field
  this.passwordConfirm = undefined;

  next();
});

// Update passwordChangedAt when password is modified
userSchema.pre<IUser>('save', function (next) {
  if (!this.isModified('password') || this.isNew) return next();

  // Subtract 1 second to ensure token is created after password change
  this.passwordChangedAt = new Date(Date.now() - 1000);

  next();
});

// ============================================
// Query Middleware
// ============================================

// Filter out inactive users by default
userSchema.pre(/^find/, function (this: mongoose.Query<any, any>, next) {
  // Only apply to find queries, not findOne for specific lookups
  this.find({ isActive: { $ne: false } });
  next();
});

// ============================================
// Instance Methods
// ============================================

// Compare passwords
userSchema.methods.correctPassword = async function (
  candidatePassword: string,
  userPassword: string
): Promise<boolean> {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// Check if password was changed after JWT was issued
userSchema.methods.changedPasswordAfter = function (JWTTimestamp: number): boolean {
  if (this.passwordChangedAt) {
    const changedTimestamp = Math.floor(this.passwordChangedAt.getTime() / 1000);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// Create password reset token
userSchema.methods.createPasswordResetToken = function (): string {
  const resetToken = crypto.randomBytes(32).toString('hex');

  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Token expires in 10 minutes
  this.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000);

  return resetToken;
};

// Create email verification token
userSchema.methods.createEmailVerificationToken = function (): string {
  const verificationToken = crypto.randomBytes(32).toString('hex');

  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');

  // Token expires in 24 hours
  this.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  return verificationToken;
};

export const User = mongoose.model<IUser, IUserModel>('User', userSchema);

export default User;
