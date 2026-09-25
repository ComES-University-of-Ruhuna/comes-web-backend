// ============================================
// ComES Backend - Team Controller
// ============================================

import { Request, Response } from 'express';
import { TeamMember } from '../models';
import { asyncHandler, NotFoundError, AppError } from '../utils';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import config from '../config';

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
  fileFilter: (_req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      callback(new AppError('Choose a JPEG, PNG, or WebP image.', 400));
      return;
    }
    callback(null, true);
  },
}).single('image');

export const uploadMemberAvatar = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { cloudName, apiKey, apiSecret } = config.cloudinary;
    if (!cloudName || !apiKey || !apiSecret) {
      throw new AppError('Image uploads are not configured. Contact the site administrator.', 503);
    }
    await new Promise<void>((resolve, reject) => {
      avatarUpload(req, res, (error: unknown) => {
        if (error instanceof multer.MulterError) {
          reject(new AppError(error.code === 'LIMIT_FILE_SIZE' ? 'Image must be 3 MB or smaller.' : 'Upload one image file only.', 400));
        } else if (error) {
          reject(error instanceof AppError ? error : new AppError('Invalid image upload.', 400));
        } else {
          resolve();
        }
      });
    });
    if (!req.file) throw new AppError('Choose an image to upload.', 400);

    const url = await new Promise<string>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        resource_type: 'image',
        folder: 'comes/team',
        allowed_formats: ['jpg', 'png', 'webp'],
        timeout: 60000,
      }, (error, result) => {
        if (error || !result?.secure_url) {
          reject(new AppError(error?.http_code === 400 ? 'The file is not a supported image.' : 'Image upload failed. Please try again.', error?.http_code === 400 ? 400 : 502));
        } else {
          resolve(result.secure_url);
        }
      });
      stream.end(req.file!.buffer);
    });
    res.status(201).json({ success: true, data: { url } });
  }
);

/**
 * @desc    Get all team members
 * @route   GET /api/v1/team
 * @access  Public
 */
export const getAllMembers = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const filter: Record<string, unknown> = { isActive: true };
    if (req.query.includeInactive === 'true' && req.user?.role === 'admin') {
      delete filter.isActive;
    }

    // Filter by department
    if (req.query.department) {
      filter.department = req.query.department;
    }

    // Filter by batch
    if (req.query.batch) {
      filter.batch = req.query.batch;
    }

    const members = await TeamMember.find(filter)
      .populate('user', 'name avatar email')
      .sort({ department: 1, order: 1 });

    // Group by department
    const grouped = members.reduce<Record<string, typeof members>>((acc, member) => {
      const dept = member.department;
      if (!acc[dept]) {
        acc[dept] = [];
      }
      acc[dept].push(member);
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: {
        members,
        grouped,
        total: members.length,
      },
    });
  }
);

/**
 * @desc    Get team by department
 * @route   GET /api/v1/team/department/:department
 * @access  Public
 */
export const getMembersByDepartment = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const members = await TeamMember.find({
      department: req.params.department,
      isActive: true,
    })
      .populate('user', 'name avatar email')
      .sort({ order: 1 });

    res.status(200).json({
      success: true,
      data: {
        members,
        count: members.length,
      },
    });
  }
);

/**
 * @desc    Get single team member
 * @route   GET /api/v1/team/:id
 * @access  Public
 */
export const getMember = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const member = await TeamMember.findOne({
      _id: req.params.id,
      ...(req.user?.role === 'admin' ? {} : { isActive: true }),
    })
      .populate('user', 'name avatar email bio linkedin github');

    if (!member) {
      throw new NotFoundError('Team member');
    }

    res.status(200).json({
      success: true,
      data: {
        member,
      },
    });
  }
);

/**
 * @desc    Create team member
 * @route   POST /api/v1/team
 * @access  Private/Admin
 */
export const createMember = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const member = await TeamMember.create(req.body);

    res.status(201).json({
      success: true,
      message: 'Team member added successfully',
      data: {
        member,
      },
    });
  }
);

/**
 * @desc    Update team member
 * @route   PATCH /api/v1/team/:id
 * @access  Private/Admin
 */
export const updateMember = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const member = await TeamMember.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!member) {
      throw new NotFoundError('Team member');
    }

    res.status(200).json({
      success: true,
      message: 'Team member updated successfully',
      data: {
        member,
      },
    });
  }
);

/**
 * @desc    Delete team member
 * @route   DELETE /api/v1/team/:id
 * @access  Private/Admin
 */
export const deleteMember = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const member = await TeamMember.findByIdAndDelete(req.params.id);

    if (!member) {
      throw new NotFoundError('Team member');
    }

    res.status(200).json({
      success: true,
      message: 'Team member deleted successfully',
      data: null,
    });
  }
);

/**
 * @desc    Reorder team members
 * @route   PATCH /api/v1/team/reorder
 * @access  Private/Admin
 */
export const reorderMembers = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { orders } = req.body; // Array of { id, order }

    const bulkOps = orders.map((item: { id: string; order: number }) => ({
      updateOne: {
        filter: { _id: item.id },
        update: { $set: { order: item.order } },
      },
    }));

    await TeamMember.bulkWrite(bulkOps);

    res.status(200).json({
      success: true,
      message: 'Team members reordered successfully',
    });
  }
);
