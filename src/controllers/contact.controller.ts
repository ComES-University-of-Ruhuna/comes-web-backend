// ============================================
// ComES Backend - Contact Controller
// ============================================

import { Request, Response } from 'express';
import { Contact } from '../models';
import { asyncHandler, NotFoundError, sendEmail, emailTemplates, logger } from '../utils';
import config from '../config';

/**
 * @desc    Submit contact form
 * @route   POST /api/v1/contact
 * @access  Public
 */
export const submitContact = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { name, email, subject, message } = req.body;

    // Create contact entry
    const contact = await Contact.create({
      name,
      email,
      subject,
      message,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    // Send confirmation email to user
    const confirmationTemplate = emailTemplates.contactConfirmation(name);
    await sendEmail({
      to: email,
      subject: confirmationTemplate.subject,
      html: confirmationTemplate.html,
      text: confirmationTemplate.text,
    });

    // Send notification to admin
    await sendEmail({
      to: config.adminEmail,
      subject: `New Contact Form Submission: ${subject}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
        <hr>
        <p><small>Submitted at: ${new Date().toISOString()}</small></p>
      `,
      text: `New contact form submission from ${name} (${email})\n\nSubject: ${subject}\n\nMessage: ${message}`,
    });

    logger.info(`Contact form submitted: ${email}`);

    res.status(201).json({
      success: true,
      message: 'Thank you for your message! We will get back to you soon.',
      data: {
        id: contact._id,
      },
    });
  }
);

/**
 * @desc    Get all contact submissions (admin)
 * @route   GET /api/v1/contact
 * @access  Private/Admin
 */
export const getAllContacts = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const filter: any = {};

    // Filter by status
    if (req.query.status) {
      filter.status = req.query.status;
    }

    // Search
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
        { subject: { $regex: req.query.search, $options: 'i' } },
      ];
    }

    const [contacts, total] = await Promise.all([
      Contact.find(filter)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Contact.countDocuments(filter),
    ]);

    res.set('X-Total-Count', total.toString());

    res.status(200).json({
      success: true,
      data: {
        contacts,
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
 * @desc    Get single contact
 * @route   GET /api/v1/contact/:id
 * @access  Private/Admin
 */
export const getContact = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const contact = await Contact.findById(req.params.id);

    if (!contact) {
      throw new NotFoundError('Contact');
    }

    // Mark as read if new
    if (contact.status === 'new') {
      contact.status = 'read';
      await contact.save();
    }

    res.status(200).json({
      success: true,
      data: {
        contact,
      },
    });
  }
);

/**
 * @desc    Reply to contact
 * @route   POST /api/v1/contact/:id/reply
 * @access  Private/Admin
 */
export const replyToContact = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { message } = req.body;

    const contact = await Contact.findById(req.params.id);

    if (!contact) {
      throw new NotFoundError('Contact');
    }

    // Send reply email
    const emailSent = await sendEmail({
      to: contact.email,
      subject: `Re: ${contact.subject}`,
      html: `
        <p>Hi ${contact.name},</p>
        <p>${message}</p>
        <hr>
        <p><small>This is a reply to your message about "${contact.subject}"</small></p>
        <p>Best regards,<br>ComES Team</p>
      `,
      text: `Hi ${contact.name},\n\n${message}\n\nBest regards,\nComES Team`,
    });

    if (emailSent) {
      contact.status = 'replied';
      contact.repliedAt = new Date();
      contact.repliedBy = req.user!._id;
      contact.replyMessage = message;
      await contact.save();

      logger.info(`Reply sent to: ${contact.email}`);
    }

    res.status(200).json({
      success: true,
      message: emailSent ? 'Reply sent successfully' : 'Failed to send reply',
      data: {
        contact,
      },
    });
  }
);

/**
 * @desc    Update contact status
 * @route   PATCH /api/v1/contact/:id
 * @access  Private/Admin
 */
export const updateContact = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true, runValidators: true }
    );

    if (!contact) {
      throw new NotFoundError('Contact');
    }

    res.status(200).json({
      success: true,
      message: 'Contact updated successfully',
      data: {
        contact,
      },
    });
  }
);

/**
 * @desc    Delete contact
 * @route   DELETE /api/v1/contact/:id
 * @access  Private/Admin
 */
export const deleteContact = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const contact = await Contact.findByIdAndDelete(req.params.id);

    if (!contact) {
      throw new NotFoundError('Contact');
    }

    res.status(200).json({
      success: true,
      message: 'Contact deleted successfully',
      data: null,
    });
  }
);
