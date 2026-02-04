// ============================================
// ComES Backend - Blog Controller
// ============================================

import { Request, Response } from 'express';
import { BlogPost } from '../models';
import { asyncHandler, NotFoundError } from '../utils';

/**
 * @desc    Get all blog posts
 * @route   GET /api/v1/blog
 * @access  Public
 */
export const getAllPosts = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const filter: any = { status: 'published' };

    // Filter by category
    if (req.query.category) {
      filter.category = req.query.category;
    }

    // Filter by tag
    if (req.query.tag) {
      filter.tags = { $in: [req.query.tag] };
    }

    // Filter featured
    if (req.query.featured === 'true') {
      filter.isFeatured = true;
    }

    // Filter by author
    if (req.query.author) {
      filter.author = req.query.author;
    }

    // Search
    if (req.query.search) {
      filter.$or = [
        { title: { $regex: req.query.search, $options: 'i' } },
        { content: { $regex: req.query.search, $options: 'i' } },
        { excerpt: { $regex: req.query.search, $options: 'i' } },
      ];
    }

    // Sorting
    let sort: any = { publishedAt: -1 };
    if (req.query.sort) {
      const sortField = (req.query.sort as string).replace('-', '');
      const sortOrder = (req.query.sort as string).startsWith('-') ? -1 : 1;
      sort = { [sortField]: sortOrder };
    }

    const [posts, total] = await Promise.all([
      BlogPost.find(filter)
        .populate('author', 'name avatar')
        .select('-content')
        .skip(skip)
        .limit(limit)
        .sort(sort),
      BlogPost.countDocuments(filter),
    ]);

    res.set('X-Total-Count', total.toString());

    res.status(200).json({
      success: true,
      data: {
        posts,
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
 * @desc    Get featured posts
 * @route   GET /api/v1/blog/featured
 * @access  Public
 */
export const getFeaturedPosts = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const limit = parseInt(req.query.limit as string) || 3;

    const posts = await BlogPost.find({ isFeatured: true, status: 'published' })
      .populate('author', 'name avatar')
      .select('-content')
      .limit(limit)
      .sort({ publishedAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        posts,
      },
    });
  }
);

/**
 * @desc    Get blog categories
 * @route   GET /api/v1/blog/categories
 * @access  Public
 */
export const getCategories = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const categories = await BlogPost.aggregate([
      { $match: { status: 'published' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        categories: categories.map((c) => ({ name: c._id, count: c.count })),
      },
    });
  }
);

/**
 * @desc    Get blog tags
 * @route   GET /api/v1/blog/tags
 * @access  Public
 */
export const getTags = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const tags = await BlogPost.aggregate([
      { $match: { status: 'published' } },
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);

    res.status(200).json({
      success: true,
      data: {
        tags: tags.map((t) => ({ name: t._id, count: t.count })),
      },
    });
  }
);

/**
 * @desc    Get single blog post
 * @route   GET /api/v1/blog/:id
 * @access  Public
 */
export const getPost = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const post = await BlogPost.findById(req.params.id)
      .populate('author', 'name avatar bio');

    if (!post) {
      throw new NotFoundError('Blog post');
    }

    // Increment view count
    post.views += 1;
    await post.save();

    res.status(200).json({
      success: true,
      data: {
        post,
      },
    });
  }
);

/**
 * @desc    Get blog post by slug
 * @route   GET /api/v1/blog/slug/:slug
 * @access  Public
 */
export const getPostBySlug = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const post = await BlogPost.findOne({ slug: req.params.slug })
      .populate('author', 'name avatar bio');

    if (!post) {
      throw new NotFoundError('Blog post');
    }

    // Increment view count
    post.views += 1;
    await post.save();

    res.status(200).json({
      success: true,
      data: {
        post,
      },
    });
  }
);

/**
 * @desc    Create blog post
 * @route   POST /api/v1/blog
 * @access  Private/Admin
 */
export const createPost = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const postData = {
      ...req.body,
      author: req.user!._id,
    };

    const post = await BlogPost.create(postData);

    res.status(201).json({
      success: true,
      message: 'Blog post created successfully',
      data: {
        post,
      },
    });
  }
);

/**
 * @desc    Update blog post
 * @route   PATCH /api/v1/blog/:id
 * @access  Private/Admin
 */
export const updatePost = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const post = await BlogPost.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!post) {
      throw new NotFoundError('Blog post');
    }

    res.status(200).json({
      success: true,
      message: 'Blog post updated successfully',
      data: {
        post,
      },
    });
  }
);

/**
 * @desc    Delete blog post
 * @route   DELETE /api/v1/blog/:id
 * @access  Private/Admin
 */
export const deletePost = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const post = await BlogPost.findByIdAndDelete(req.params.id);

    if (!post) {
      throw new NotFoundError('Blog post');
    }

    res.status(200).json({
      success: true,
      message: 'Blog post deleted successfully',
      data: null,
    });
  }
);

/**
 * @desc    Like a blog post
 * @route   POST /api/v1/blog/:id/like
 * @access  Public
 */
export const likePost = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const post = await BlogPost.findByIdAndUpdate(
      req.params.id,
      { $inc: { likes: 1 } },
      { new: true }
    );

    if (!post) {
      throw new NotFoundError('Blog post');
    }

    res.status(200).json({
      success: true,
      data: {
        likes: post.likes,
      },
    });
  }
);
