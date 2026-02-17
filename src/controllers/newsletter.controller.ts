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
 * @desc    Send newsletter to all active subscribers
 * @route   POST /api/v1/newsletter/send
 * @access  Private/Admin
 */
export const sendNewsletter = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { subject, message } = req.body;

    if (!subject || !message) {
      throw new AppError('Subject and message are required', 400);
    }

    const subscribers = await Newsletter.find({ isSubscribed: true }).select('email name');

    if (subscribers.length === 0) {
      throw new AppError('No active subscribers found', 404);
    }

    let sentCount = 0;
    const failedEmails: string[] = [];

    // Send emails in batches to avoid overwhelming the email service
    const batchSize = 10;
    for (let i = 0; i < subscribers.length; i += batchSize) {
      const batch = subscribers.slice(i, i + batchSize);
      const emailPromises = batch.map(async (subscriber) => {
        try {
          await sendEmail({
            to: subscriber.email,
            subject,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #003366 0%, #0066cc 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                  <h1 style="color: white; margin: 0; font-size: 28px;">ComES Newsletter</h1>
                  <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0; font-size: 14px;">Computer Engineering Society - University of Ruhuna</p>
                </div>
                
                <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
                  ${subscriber.name ? `<p style="color: #374151; font-size: 16px; line-height: 1.6;">Dear <strong>${subscriber.name}</strong>,</p>` : ''}
                  
                  <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #003366;">
                    <p style="color: #1f2937; font-size: 16px; line-height: 1.6; margin: 0;">
                      ${message.split('\n').join('<br>')}
                    </p>
                  </div>
                  
                  <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin-top: 30px;">
                    Best regards,<br>
                    <strong>ComES Team</strong><br>
                    University of Ruhuna
                  </p>
                  
                  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                  
                  <p style="color: #9ca3af; font-size: 12px; text-align: center;">
                    You received this email because you subscribed to the ComES newsletter.<br>
                    To unsubscribe, please visit our website.
                  </p>
                </div>
              </div>
            `,
          });
          sentCount++;
        } catch (err) {
          failedEmails.push(subscriber.email);
          logger.error(`Failed to send newsletter to ${subscriber.email}: ${err}`);
        }
      });

      await Promise.all(emailPromises);
    }

    logger.info(`Newsletter sent: ${sentCount}/${subscribers.length} successful. Subject: ${subject}`);

    res.status(200).json({
      success: true,
      message: `Newsletter sent to ${sentCount} out of ${subscribers.length} subscribers`,
      data: {
        sentCount,
        totalSubscribers: subscribers.length,
        failedEmails: failedEmails.length > 0 ? failedEmails : undefined,
      },
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
