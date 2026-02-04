// ============================================
// ComES Backend - Email Utility
// ============================================

import nodemailer from 'nodemailer';
import config from '../config';
import { logger } from './logger';

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

// Create transporter
const createTransporter = () => {
  if (!config.email.user || !config.email.pass) {
    logger.warn('Email credentials not configured. Emails will not be sent.');
    return null;
  }

  return nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.port === 465,
    auth: {
      user: config.email.user,
      pass: config.email.pass,
    },
  });
};

// Send email
export const sendEmail = async (options: EmailOptions): Promise<boolean> => {
  const transporter = createTransporter();
  
  if (!transporter) {
    logger.warn('Email not sent - transporter not configured');
    return false;
  }

  try {
    const mailOptions = {
      from: config.email.from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent: ${info.messageId}`);
    return true;
  } catch (error) {
    logger.error('Error sending email:', error);
    return false;
  }
};

// Email templates
export const emailTemplates = {
  welcome: (name: string): EmailTemplate => ({
    subject: 'Welcome to ComES!',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #003366; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
            .btn { display: inline-block; padding: 12px 24px; background: #003366; color: white; text-decoration: none; border-radius: 5px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to ComES!</h1>
            </div>
            <div class="content">
              <p>Hi ${name},</p>
              <p>Welcome to the Computer Engineering Society! We're excited to have you as part of our community.</p>
              <p>As a member, you'll have access to:</p>
              <ul>
                <li>Exclusive events and workshops</li>
                <li>Networking opportunities</li>
                <li>Project collaboration</li>
                <li>Career development resources</li>
              </ul>
              <p>Stay connected and make the most of your membership!</p>
            </div>
            <div class="footer">
              <p>Computer Engineering Society - University of Ruhuna</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `Hi ${name},\n\nWelcome to the Computer Engineering Society! We're excited to have you as part of our community.\n\nBest regards,\nComES Team`,
  }),

  passwordReset: (name: string, resetUrl: string): EmailTemplate => ({
    subject: 'Password Reset Request - ComES',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #003366; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
            .btn { display: inline-block; padding: 12px 24px; background: #003366; color: white; text-decoration: none; border-radius: 5px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset</h1>
            </div>
            <div class="content">
              <p>Hi ${name},</p>
              <p>You requested a password reset for your ComES account.</p>
              <p>Click the button below to reset your password. This link is valid for 10 minutes.</p>
              <p style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" class="btn">Reset Password</a>
              </p>
              <p>If you didn't request this, please ignore this email.</p>
            </div>
            <div class="footer">
              <p>Computer Engineering Society - University of Ruhuna</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `Hi ${name},\n\nYou requested a password reset. Visit this link to reset your password: ${resetUrl}\n\nThis link is valid for 10 minutes.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nComES Team`,
  }),

  contactConfirmation: (name: string): EmailTemplate => ({
    subject: 'We received your message - ComES',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #003366; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Message Received</h1>
            </div>
            <div class="content">
              <p>Hi ${name},</p>
              <p>Thank you for reaching out to ComES! We've received your message and will get back to you as soon as possible.</p>
              <p>In the meantime, feel free to explore our website or follow us on social media for updates.</p>
            </div>
            <div class="footer">
              <p>Computer Engineering Society - University of Ruhuna</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `Hi ${name},\n\nThank you for reaching out to ComES! We've received your message and will get back to you as soon as possible.\n\nBest regards,\nComES Team`,
  }),

  newsletterWelcome: (email: string): EmailTemplate => ({
    subject: 'Welcome to ComES Newsletter!',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #003366; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Newsletter Subscription</h1>
            </div>
            <div class="content">
              <p>Thank you for subscribing to the ComES newsletter!</p>
              <p>You'll now receive updates about:</p>
              <ul>
                <li>Upcoming events and workshops</li>
                <li>New projects and achievements</li>
                <li>Career opportunities</li>
                <li>Tech news and insights</li>
              </ul>
            </div>
            <div class="footer">
              <p>Computer Engineering Society - University of Ruhuna</p>
              <p><small>To unsubscribe, click <a href="#">here</a></small></p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `Thank you for subscribing to the ComES newsletter!\n\nYou'll now receive updates about upcoming events, projects, and opportunities.\n\nBest regards,\nComES Team`,
  }),
};

export default { sendEmail, emailTemplates };
