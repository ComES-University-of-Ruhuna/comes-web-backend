// ============================================
// ComES Backend - Auth Controller
// ============================================

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User, IUser } from '../models';
import { asyncHandler, AppError, AuthenticationError, sendEmail, emailTemplates, logger } from '../utils';
import config from '../config';

// Generate JWT token
const signToken = (id: string): string => {
  return jwt.sign({ id }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
};

// Generate refresh token
const signRefreshToken = (id: string): string => {
  return jwt.sign({ id }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  });
};

// Create and send tokens
const createSendToken = (
  user: IUser,
  statusCode: number,
  req: Request,
  res: Response
): void => {
  const token = signToken(user._id.toString());
  const refreshToken = signRefreshToken(user._id.toString());

  // Cookie options
  const cookieOptions = {
    expires: new Date(Date.now() + config.jwt.cookieExpiresIn * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
    sameSite: 'lax' as const,
  };

  // Set cookies
  res.cookie('jwt', token, cookieOptions);
  res.cookie('refreshToken', refreshToken, {
    ...cookieOptions,
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  });

  // Remove password from output
  const userResponse = user.toObject();
  delete userResponse.password;

  res.status(statusCode).json({
    success: true,
    message: statusCode === 201 ? 'Account created successfully' : 'Login successful',
    data: {
      user: userResponse,
      token,
      refreshToken,
    },
  });
};

/**
 * @desc    Register a new user
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
export const register = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { name, email, password, passwordConfirm, studentId } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new AppError('An account with this email already exists', 400);
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      passwordConfirm,
      studentId,
    });

    // Send welcome email
    const template = emailTemplates.welcome(name);
    await sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    logger.info(`New user registered: ${email}`);

    createSendToken(user, 201, req, res);
  }
);

/**
 * @desc    Login user
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
export const login = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { email, password } = req.body;

    // Check if email and password exist
    if (!email || !password) {
      throw new AuthenticationError('Please provide email and password');
    }

    // Check if user exists && password is correct
    const user = await User.findOne({ email }).select('+password +isActive');

    if (!user || !(await user.correctPassword(password, user.password))) {
      throw new AuthenticationError('Incorrect email or password');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new AuthenticationError('This account has been deactivated');
    }

    logger.info(`User logged in: ${email}`);

    createSendToken(user, 200, req, res);
  }
);

/**
 * @desc    Logout user
 * @route   POST /api/v1/auth/logout
 * @access  Private
 */
export const logout = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    // Clear cookies
    res.cookie('jwt', 'loggedout', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true,
    });
    res.cookie('refreshToken', 'loggedout', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true,
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  }
);

/**
 * @desc    Refresh access token
 * @route   POST /api/v1/auth/refresh-token
 * @access  Public
 */
export const refreshToken = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { refreshToken } = req.cookies || req.body;

    if (!refreshToken) {
      throw new AuthenticationError('No refresh token provided');
    }

    try {
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as { id: string };
      const user = await User.findById(decoded.id);

      if (!user) {
        throw new AuthenticationError('Invalid refresh token');
      }

      // Generate new access token
      const newAccessToken = signToken(user._id.toString());

      res.cookie('jwt', newAccessToken, {
        expires: new Date(Date.now() + config.jwt.cookieExpiresIn * 24 * 60 * 60 * 1000),
        httpOnly: true,
        secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
        sameSite: 'lax',
      });

      res.status(200).json({
        success: true,
        data: {
          token: newAccessToken,
        },
      });
    } catch {
      throw new AuthenticationError('Invalid or expired refresh token');
    }
  }
);

/**
 * @desc    Forgot password - send reset email
 * @route   POST /api/v1/auth/forgot-password
 * @access  Public
 */
export const forgotPassword = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body;

    const user = await User.findOne({ email });

    // Always return success to prevent email enumeration
    if (!user) {
      res.status(200).json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
      return;
    }

    // Generate reset token
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    // Create reset URL
    const resetUrl = `${config.frontendUrl}/reset-password/${resetToken}`;

    // Send email
    const template = emailTemplates.passwordReset(user.name, resetUrl);
    const emailSent = await sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    if (!emailSent) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });

      throw new AppError('There was an error sending the email. Please try again later.', 500);
    }

    logger.info(`Password reset email sent to: ${email}`);

    res.status(200).json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  }
);

/**
 * @desc    Reset password
 * @route   PATCH /api/v1/auth/reset-password/:token
 * @access  Public
 */
export const resetPassword = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { token } = req.params;
    const { password, passwordConfirm } = req.body;

    // Hash token
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find user with valid token
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      throw new AppError('Token is invalid or has expired', 400);
    }

    // Update password
    user.password = password;
    user.passwordConfirm = passwordConfirm;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    logger.info(`Password reset successful for: ${user.email}`);

    createSendToken(user, 200, req, res);
  }
);

/**
 * @desc    Update password (for logged in users)
 * @route   PATCH /api/v1/auth/update-password
 * @access  Private
 */
export const updatePassword = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { currentPassword, password, passwordConfirm } = req.body;

    // Get user with password
    const user = await User.findById(req.user!._id).select('+password');

    if (!user) {
      throw new AuthenticationError('User not found');
    }

    // Check current password
    if (!(await user.correctPassword(currentPassword, user.password))) {
      throw new AuthenticationError('Current password is incorrect');
    }

    // Update password
    user.password = password;
    user.passwordConfirm = passwordConfirm;
    await user.save();

    logger.info(`Password updated for: ${user.email}`);

    createSendToken(user, 200, req, res);
  }
);

/**
 * @desc    Get current logged in user
 * @route   GET /api/v1/auth/me
 * @access  Private
 */
export const getMe = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const user = await User.findById(req.user!._id);

    res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  }
);
