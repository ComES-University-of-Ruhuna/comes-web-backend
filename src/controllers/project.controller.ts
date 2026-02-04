// ============================================
// ComES Backend - Project Controller
// ============================================

import { Request, Response } from 'express';
import { Project } from '../models';
import { asyncHandler, NotFoundError } from '../utils';

/**
 * @desc    Get all projects
 * @route   GET /api/v1/projects
 * @access  Public
 */
export const getAllProjects = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 12;
    const skip = (page - 1) * limit;

    const filter: any = {};

    // Filter by category
    if (req.query.category) {
      filter.category = req.query.category;
    }

    // Filter by status
    if (req.query.status) {
      filter.status = req.query.status;
    }

    // Filter featured
    if (req.query.featured === 'true') {
      filter.isFeatured = true;
    }

    // Filter by technology
    if (req.query.technology) {
      filter.technologies = { $in: [req.query.technology] };
    }

    // Search
    if (req.query.search) {
      filter.$or = [
        { title: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } },
        { technologies: { $in: [new RegExp(req.query.search as string, 'i')] } },
      ];
    }

    // Sorting
    let sort: any = { createdAt: -1 };
    if (req.query.sort) {
      const sortField = (req.query.sort as string).replace('-', '');
      const sortOrder = (req.query.sort as string).startsWith('-') ? -1 : 1;
      sort = { [sortField]: sortOrder };
    }

    const [projects, total] = await Promise.all([
      Project.find(filter)
        .populate('team', 'name avatar')
        .populate('teamLead', 'name avatar')
        .skip(skip)
        .limit(limit)
        .sort(sort),
      Project.countDocuments(filter),
    ]);

    res.set('X-Total-Count', total.toString());

    res.status(200).json({
      success: true,
      data: {
        projects,
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
 * @desc    Get featured projects
 * @route   GET /api/v1/projects/featured
 * @access  Public
 */
export const getFeaturedProjects = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const limit = parseInt(req.query.limit as string) || 6;

    const projects = await Project.find({ isFeatured: true })
      .populate('team', 'name avatar')
      .limit(limit)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        projects,
      },
    });
  }
);

/**
 * @desc    Get project categories
 * @route   GET /api/v1/projects/categories
 * @access  Public
 */
export const getCategories = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const categories = await Project.distinct('category');

    res.status(200).json({
      success: true,
      data: {
        categories,
      },
    });
  }
);

/**
 * @desc    Get single project
 * @route   GET /api/v1/projects/:id
 * @access  Public
 */
export const getProject = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const project = await Project.findById(req.params.id)
      .populate('team', 'name avatar bio linkedin github')
      .populate('teamLead', 'name avatar bio linkedin github')
      .populate('createdBy', 'name');

    if (!project) {
      throw new NotFoundError('Project');
    }

    // Increment view count
    project.views += 1;
    await project.save();

    res.status(200).json({
      success: true,
      data: {
        project,
      },
    });
  }
);

/**
 * @desc    Get project by slug
 * @route   GET /api/v1/projects/slug/:slug
 * @access  Public
 */
export const getProjectBySlug = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const project = await Project.findOne({ slug: req.params.slug })
      .populate('team', 'name avatar bio linkedin github')
      .populate('teamLead', 'name avatar bio linkedin github');

    if (!project) {
      throw new NotFoundError('Project');
    }

    // Increment view count
    project.views += 1;
    await project.save();

    res.status(200).json({
      success: true,
      data: {
        project,
      },
    });
  }
);

/**
 * @desc    Create project
 * @route   POST /api/v1/projects
 * @access  Private/Admin
 */
export const createProject = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const projectData = {
      ...req.body,
      createdBy: req.user!._id,
    };

    const project = await Project.create(projectData);

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: {
        project,
      },
    });
  }
);

/**
 * @desc    Update project
 * @route   PATCH /api/v1/projects/:id
 * @access  Private/Admin
 */
export const updateProject = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const project = await Project.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!project) {
      throw new NotFoundError('Project');
    }

    res.status(200).json({
      success: true,
      message: 'Project updated successfully',
      data: {
        project,
      },
    });
  }
);

/**
 * @desc    Delete project
 * @route   DELETE /api/v1/projects/:id
 * @access  Private/Admin
 */
export const deleteProject = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const project = await Project.findByIdAndDelete(req.params.id);

    if (!project) {
      throw new NotFoundError('Project');
    }

    res.status(200).json({
      success: true,
      message: 'Project deleted successfully',
      data: null,
    });
  }
);

/**
 * @desc    Like a project
 * @route   POST /api/v1/projects/:id/like
 * @access  Public
 */
export const likeProject = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { $inc: { likes: 1 } },
      { new: true }
    );

    if (!project) {
      throw new NotFoundError('Project');
    }

    res.status(200).json({
      success: true,
      data: {
        likes: project.likes,
      },
    });
  }
);
