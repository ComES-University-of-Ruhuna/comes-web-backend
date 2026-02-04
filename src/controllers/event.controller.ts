// ============================================
// ComES Backend - Event Controller
// ============================================

import { Request, Response } from 'express';
import { Event } from '../models';
import { asyncHandler, NotFoundError, AppError } from '../utils';

/**
 * @desc    Get all events
 * @route   GET /api/v1/events
 * @access  Public
 */
export const getAllEvents = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const filter: any = {};

    // Filter by status
    if (req.query.status) {
      filter.status = req.query.status;
    }

    // Filter by type
    if (req.query.type) {
      filter.type = req.query.type;
    }

    // Filter featured
    if (req.query.featured === 'true') {
      filter.isFeatured = true;
    }

    // Filter upcoming events
    if (req.query.upcoming === 'true') {
      filter.date = { $gte: new Date() };
      filter.status = 'upcoming';
    }

    // Search
    if (req.query.search) {
      filter.$or = [
        { title: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } },
      ];
    }

    // Sorting
    let sort: any = { date: -1 };
    if (req.query.sort) {
      const sortField = (req.query.sort as string).replace('-', '');
      const sortOrder = (req.query.sort as string).startsWith('-') ? -1 : 1;
      sort = { [sortField]: sortOrder };
    }

    const [events, total] = await Promise.all([
      Event.find(filter)
        .populate('createdBy', 'name avatar')
        .skip(skip)
        .limit(limit)
        .sort(sort),
      Event.countDocuments(filter),
    ]);

    res.set('X-Total-Count', total.toString());

    res.status(200).json({
      success: true,
      data: {
        events,
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
 * @desc    Get featured events
 * @route   GET /api/v1/events/featured
 * @access  Public
 */
export const getFeaturedEvents = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const limit = parseInt(req.query.limit as string) || 4;

    const events = await Event.find({ isFeatured: true })
      .populate('createdBy', 'name avatar')
      .limit(limit)
      .sort({ date: 1 });

    res.status(200).json({
      success: true,
      data: {
        events,
      },
    });
  }
);

/**
 * @desc    Get single event
 * @route   GET /api/v1/events/:id
 * @access  Public
 */
export const getEvent = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const event = await Event.findById(req.params.id)
      .populate('createdBy', 'name avatar')
      .populate('registrations', 'name avatar');

    if (!event) {
      throw new NotFoundError('Event');
    }

    res.status(200).json({
      success: true,
      data: {
        event,
      },
    });
  }
);

/**
 * @desc    Get event by slug
 * @route   GET /api/v1/events/slug/:slug
 * @access  Public
 */
export const getEventBySlug = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const event = await Event.findOne({ slug: req.params.slug })
      .populate('createdBy', 'name avatar');

    if (!event) {
      throw new NotFoundError('Event');
    }

    res.status(200).json({
      success: true,
      data: {
        event,
      },
    });
  }
);

/**
 * @desc    Create event
 * @route   POST /api/v1/events
 * @access  Private/Admin
 */
export const createEvent = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const eventData = {
      ...req.body,
      createdBy: req.user!._id,
    };

    const event = await Event.create(eventData);

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: {
        event,
      },
    });
  }
);

/**
 * @desc    Update event
 * @route   PATCH /api/v1/events/:id
 * @access  Private/Admin
 */
export const updateEvent = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const event = await Event.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!event) {
      throw new NotFoundError('Event');
    }

    res.status(200).json({
      success: true,
      message: 'Event updated successfully',
      data: {
        event,
      },
    });
  }
);

/**
 * @desc    Delete event
 * @route   DELETE /api/v1/events/:id
 * @access  Private/Admin
 */
export const deleteEvent = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const event = await Event.findByIdAndDelete(req.params.id);

    if (!event) {
      throw new NotFoundError('Event');
    }

    res.status(200).json({
      success: true,
      message: 'Event deleted successfully',
      data: null,
    });
  }
);

/**
 * @desc    Register for event
 * @route   POST /api/v1/events/:id/register
 * @access  Private
 */
export const registerForEvent = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const event = await Event.findById(req.params.id);

    if (!event) {
      throw new NotFoundError('Event');
    }

    if (event.status !== 'upcoming') {
      throw new AppError('Registration is closed for this event', 400);
    }

    // Check if already registered
    if (event.registrations.includes(req.user!._id)) {
      throw new AppError('You are already registered for this event', 400);
    }

    // Check if event is full
    if (event.maxParticipants && event.registeredCount >= event.maxParticipants) {
      throw new AppError('This event is full', 400);
    }

    // Add user to registrations
    event.registrations.push(req.user!._id);
    event.registeredCount = event.registrations.length;
    await event.save();

    res.status(200).json({
      success: true,
      message: 'Successfully registered for event',
      data: {
        event,
      },
    });
  }
);

/**
 * @desc    Unregister from event
 * @route   DELETE /api/v1/events/:id/register
 * @access  Private
 */
export const unregisterFromEvent = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const event = await Event.findById(req.params.id);

    if (!event) {
      throw new NotFoundError('Event');
    }

    // Check if registered
    const index = event.registrations.indexOf(req.user!._id);
    if (index === -1) {
      throw new AppError('You are not registered for this event', 400);
    }

    // Remove user from registrations
    event.registrations.splice(index, 1);
    event.registeredCount = event.registrations.length;
    await event.save();

    res.status(200).json({
      success: true,
      message: 'Successfully unregistered from event',
      data: {
        event,
      },
    });
  }
);
