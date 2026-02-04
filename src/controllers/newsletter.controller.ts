// ============================================
// ComES Backend - Newsletter Controller
// ============================================

import { Request, Response } from 'express';
import { Newsletter } from '../models';
import { asyncHandler, AppError, NotFoundError, sendEmail, emailTemplates, logger } from '../utils';

/**
 * @desc    Subscribe to newsletter
 * @route   POST /api/v1/newsletter/subscribe
 * @access  Public
 */
export const subscribe = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { email, name } = req.body;

    // Check if already subscribed
    let subscriber = await Newsletter.findOne({ email });

    if (subscriber) {
      if (subscriber.isSubscribed) {
        res.status(200).json({
          success: true,
          message: 'You are already subscribed to our newsletter!',
        });
        return;
      } else {
        // Re-subscribe
        subscriber.isSubscribed = true;
        subscriber.subscribedAt = new Date();
        subscriber.unsubscribedAt = undefined;
        if (name) subscriber.name = name;
        await subscriber.save();
      }
    } else {
      // Create new subscriber
      subscriber = await Newsletter.create({ email, name });
    }

    // Send welcome email
    const template = emailTemplates.newsletterWelcome(email);
    await sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    logger.info(`Newsletter subscription: ${email}`);

    res.status(201).json({
      success: true,
      message: 'Successfully subscribed to the newsletter!',
    });
  }
);

/**
 * @desc    Unsubscribe from newsletter
 * @route   POST /api/v1/newsletter/unsubscribe
 * @access  Public
 */
export const unsubscribe = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { email, token } = req.body;

    let subscriber;

    if (token) {
      subscriber = await Newsletter.findOne({ unsubscribeToken: token });
    } else if (email) {
      subscriber = await Newsletter.findOne({ email });
    }

    if (!subscriber) {
      throw new NotFoundError('Subscription');
    }

    subscriber.isSubscribed = false;
    subscriber.unsubscribedAt = new Date();
    await subscriber.save();

    logger.info(`Newsletter unsubscription: ${subscriber.email}`);

    res.status(200).json({
      success: true,
      message: 'Successfully unsubscribed from the newsletter.',
    });
  }
);

/**
 * @desc    Get all subscribers (admin)
 * @route   GET /api/v1/newsletter
 * @access  Private/Admin
 */
export const getAllSubscribers = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const filter: any = {};

    // Filter by subscription status
    if (req.query.subscribed === 'true') {
      filter.isSubscribed = true;
    } else if (req.query.subscribed === 'false') {
      filter.isSubscribed = false;
    }

    // Search
    if (req.query.search) {
      filter.$or = [
        { email: { $regex: req.query.search, $options: 'i' } },
        { name: { $regex: req.query.search, $options: 'i' } },
      ];
    }

    const [subscribers, total, activeCount] = await Promise.all([
      Newsletter.find(filter)
        .skip(skip)
        .limit(limit)
        .sort({ subscribedAt: -1 }),
      Newsletter.countDocuments(filter),
      Newsletter.countDocuments({ isSubscribed: true }),
    ]);

    res.set('X-Total-Count', total.toString());

    res.status(200).json({
      success: true,
      data: {
        subscribers,
        stats: {
          total,
          active: activeCount,
          inactive: total - activeCount,
        },
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
 * @desc    Delete subscriber (admin)
 * @route   DELETE /api/v1/newsletter/:id
 * @access  Private/Admin
 */
export const deleteSubscriber = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const subscriber = await Newsletter.findByIdAndDelete(req.params.id);

    if (!subscriber) {
      throw new NotFoundError('Subscriber');
    }

    res.status(200).json({
      success: true,
      message: 'Subscriber deleted successfully',
      data: null,
    });
  }
);

/**
 * @desc    Export subscribers as CSV (admin)
 * @route   GET /api/v1/newsletter/export
 * @access  Private/Admin
 */
export const exportSubscribers = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const subscribers = await Newsletter.find({ isSubscribed: true })
      .select('email name subscribedAt')
      .sort({ subscribedAt: -1 });

    // Generate CSV
    const csv = [
      'Email,Name,Subscribed At',
      ...subscribers.map((s) => 
        `${s.email},${s.name || ''},${s.subscribedAt.toISOString()}`
      ),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=newsletter-subscribers.csv');
    res.send(csv);
  }
);
