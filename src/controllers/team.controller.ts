// ============================================
// ComES Backend - Team Controller
// ============================================

import { Request, Response } from 'express';
import { TeamMember } from '../models';
import { asyncHandler, NotFoundError } from '../utils';

/**
 * @desc    Get all team members
 * @route   GET /api/v1/team
 * @access  Public
 */
export const getAllMembers = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const filter: any = { isActive: true };

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
    const grouped = members.reduce((acc: any, member) => {
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
    const member = await TeamMember.findById(req.params.id)
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
