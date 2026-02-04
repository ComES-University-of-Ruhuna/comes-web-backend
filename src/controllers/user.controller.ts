// ============================================
// ComES Backend - User Controller
// ============================================

import { Request, Response } from 'express';
import { User } from '../models';
import { asyncHandler, AppError, NotFoundError, AuthorizationError } from '../utils';

/**
 * @desc    Get all users (admin only)
 * @route   GET /api/v1/users
 * @access  Private/Admin
 */
export const getAllUsers = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const filter: any = {};

    // Filter by role
    if (req.query.role) {
      filter.role = req.query.role;
    }

    // Search by name or email
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-__v')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      User.countDocuments(filter),
    ]);

    res.set('X-Total-Count', total.toString());
    res.set('X-Page', page.toString());
    res.set('X-Limit', limit.toString());

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  }
);

/**
 * @desc    Get single user by ID
 * @route   GET /api/v1/users/:id
 * @access  Private
 */
export const getUser = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const user = await User.findById(req.params.id).select('-__v');

    if (!user) {
      throw new NotFoundError('User');
    }

    res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  }
);

/**
 * @desc    Update current user profile
 * @route   PATCH /api/v1/users/me
 * @access  Private
 */
export const updateMe = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    // Prevent password updates through this route
    if (req.body.password || req.body.passwordConfirm) {
      throw new AppError(
        'This route is not for password updates. Please use /auth/update-password',
        400
      );
    }

    // Prevent role updates through this route
    if (req.body.role) {
      throw new AppError('You cannot update your role', 400);
    }

    // Filter allowed fields
    const allowedFields = ['name', 'bio', 'linkedin', 'github', 'avatar'];
    const filteredBody: any = {};
    
    Object.keys(req.body).forEach((key) => {
      if (allowedFields.includes(key)) {
        filteredBody[key] = req.body[key];
      }
    });

    const updatedUser = await User.findByIdAndUpdate(
      req.user!._id,
      filteredBody,
      {
        new: true,
        runValidators: true,
      }
    );

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: updatedUser,
      },
    });
  }
);

/**
 * @desc    Deactivate current user account
 * @route   DELETE /api/v1/users/me
 * @access  Private
 */
export const deleteMe = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    await User.findByIdAndUpdate(req.user!._id, { isActive: false });

    res.status(200).json({
      success: true,
      message: 'Account deactivated successfully',
      data: null,
    });
  }
);

/**
 * @desc    Update user (admin only)
 * @route   PATCH /api/v1/users/:id
 * @access  Private/Admin
 */
export const updateUser = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    // Prevent password updates through this route
    if (req.body.password || req.body.passwordConfirm) {
      throw new AppError('Use the password reset functionality to update passwords', 400);
    }

    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: {
        user,
      },
    });
  }
);

/**
 * @desc    Delete user (admin only)
 * @route   DELETE /api/v1/users/:id
 * @access  Private/Admin
 */
export const deleteUser = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const user = await User.findById(req.params.id);

    if (!user) {
      throw new NotFoundError('User');
    }

    // Prevent deleting own account through this route
    if (user._id.toString() === req.user!._id.toString()) {
      throw new AuthorizationError('You cannot delete your own account through this route');
    }

    await User.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
      data: null,
    });
  }
);
