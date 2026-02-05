// ============================================
// ComES Backend - Student Controller
// ============================================

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { Student, IStudent } from '../models/student.model';
import { Event } from '../models';
import { asyncHandler, AppError, logger } from '../utils';
import config from '../config';

// Generate JWT token
const signToken = (id: string): string => {
  return jwt.sign({ id, type: 'student' }, config.jwt.secret as jwt.Secret, {
    expiresIn: config.jwt.expiresIn,
  } as jwt.SignOptions);
};

// Generate refresh token
const signRefreshToken = (id: string): string => {
  return jwt.sign({ id, type: 'student' }, config.jwt.refreshSecret as jwt.Secret, {
    expiresIn: config.jwt.refreshExpiresIn,
  } as jwt.SignOptions);
};

// Create and send tokens
const createSendToken = (
  student: IStudent,
  statusCode: number,
  req: Request,
  res: Response
): void => {
  const accessToken = signToken(student._id.toString());
  const refreshToken = signRefreshToken(student._id.toString());

  // Cookie options
  const cookieOptions = {
    expires: new Date(Date.now() + config.jwt.cookieExpiresIn * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
    sameSite: 'lax' as const,
  };

  res.cookie('studentJwt', accessToken, cookieOptions);
  res.cookie('studentRefreshToken', refreshToken, {
    ...cookieOptions,
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  // Remove password from output
  const studentResponse = student.toObject();
  delete studentResponse.password;

  res.status(statusCode).json({
    success: true,
    message: statusCode === 201 ? 'Student registered successfully' : 'Login successful',
    data: {
      student: studentResponse,
      accessToken,
      refreshToken,
    },
  });
};

/**
 * @desc    Register a new student
 * @route   POST /api/v1/students/register
 * @access  Public
 */
export const register = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { name, email, password, passwordConfirm, registrationNo, contactNo } = req.body;

    // Validate password confirmation
    if (password !== passwordConfirm) {
      throw new AppError('Passwords do not match', 400);
    }

    // Check if student already exists
    const existingStudent = await Student.findOne({
      $or: [{ email }, { registrationNo }],
    });

    if (existingStudent) {
      if (existingStudent.email === email) {
        throw new AppError('An account with this email already exists', 400);
      }
      throw new AppError('An account with this registration number already exists', 400);
    }

    // Create student
    const student = await Student.create({
      name,
      email,
      password,
      registrationNo,
      contactNo,
    });

    logger.info(`New student registered: ${email}`);
    createSendToken(student, 201, req, res);
  }
);

/**
 * @desc    Login student
 * @route   POST /api/v1/students/login
 * @access  Public
 */
export const login = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { email, password } = req.body;

    // Check if email and password exist
    if (!email || !password) {
      throw new AppError('Please provide email and password', 400);
    }

    // Check if student exists and password is correct
    const student = await Student.findOne({ email }).select('+password');

    if (!student || !(await student.comparePassword(password))) {
      throw new AppError('Incorrect email or password', 401);
    }

    logger.info(`Student logged in: ${email}`);
    createSendToken(student, 200, req, res);
  }
);

/**
 * @desc    Get current student profile
 * @route   GET /api/v1/students/me
 * @access  Private (Student)
 */
export const getProfile = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const student = await Student.findById(req.student?._id).populate('registeredEvents');

    if (!student) {
      throw new AppError('Student not found', 404);
    }

    res.status(200).json({
      success: true,
      data: { student },
    });
  }
);

/**
 * @desc    Update student profile
 * @route   PATCH /api/v1/students/me
 * @access  Private (Student)
 */
export const updateProfile = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    // Fields that cannot be updated
    const disallowedFields = ['password', 'email', 'registrationNo', 'batch'];
    disallowedFields.forEach((field) => delete req.body[field]);

    const student = await Student.findByIdAndUpdate(req.student?._id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!student) {
      throw new AppError('Student not found', 404);
    }

    res.status(200).json({
      success: true,
      data: { student },
    });
  }
);

/**
 * @desc    Verify student email
 * @route   GET /api/v1/students/verify-email/:token
 * @access  Public
 */
export const verifyEmail = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const hashedToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const student = await Student.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (!student) {
      throw new AppError('Invalid or expired verification token', 400);
    }

    student.isEmailVerified = true;
    student.emailVerificationToken = undefined;
    student.emailVerificationExpires = undefined;
    await student.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: 'Email verified successfully',
    });
  }
);

/**
 * @desc    Get all students (admin)
 * @route   GET /api/v1/students
 * @access  Private (Admin)
 */
export const getAllStudents = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Build filter
    const filter: Record<string, unknown> = {};
    if (req.query.batch) filter.batch = req.query.batch;
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
        { registrationNo: { $regex: req.query.search, $options: 'i' } },
      ];
    }

    const [students, total] = await Promise.all([
      Student.find(filter).skip(skip).limit(limit).sort('-createdAt'),
      Student.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        students,
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  }
);

/**
 * @desc    Search students
 * @route   GET /api/v1/students/search
 * @access  Private (Student)
 */
export const searchStudents = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const query = req.query.query as string;

    if (!query || query.length < 2) {
      throw new AppError('Search query must be at least 2 characters', 400);
    }

    const students = await Student.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
        { registrationNo: { $regex: query, $options: 'i' } },
      ],
    })
      .select('name email registrationNo avatar')
      .limit(10);

    res.status(200).json({
      success: true,
      data: { students },
    });
  }
);

/**
 * @desc    Change student password
 * @route   POST /api/v1/students/change-password
 * @access  Private (Student)
 */
export const changePassword = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
      throw new AppError('Passwords do not match', 400);
    }

    const student = await Student.findById(req.student?._id).select('+password');

    if (!student || !(await student.comparePassword(currentPassword))) {
      throw new AppError('Current password is incorrect', 401);
    }

    student.password = newPassword;
    await student.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  }
);

/**
 * @desc    Get student's registered events
 * @route   GET /api/v1/students/my-events
 * @access  Private (Student)
 */
export const getMyEvents = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const student = await Student.findById(req.student?._id).populate({
      path: 'registeredEvents',
      select: 'title date status',
    });

    if (!student) {
      throw new AppError('Student not found', 404);
    }

    res.status(200).json({
      success: true,
      data: { events: student.registeredEvents },
    });
  }
);

/**
 * @desc    Register for an event
 * @route   POST /api/v1/students/events/:eventId/register
 * @access  Private (Student)
 */
export const registerForEvent = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { eventId } = req.params;
    const studentId = req.student?._id;

    const event = await Event.findById(eventId);
    if (!event) {
      throw new AppError('Event not found', 404);
    }

    // Check if already registered
    const student = await Student.findById(studentId);
    if (!student) {
      throw new AppError('Student not found', 404);
    }

    if (student.registeredEvents.includes(event._id)) {
      throw new AppError('Already registered for this event', 400);
    }

    // Check capacity
    if (event.maxParticipants && event.registrations.length >= event.maxParticipants) {
      throw new AppError('Event is at full capacity', 400);
    }

    // Register student
    student.registeredEvents.push(event._id);
    event.registrations.push(studentId!);

    await Promise.all([student.save(), event.save()]);

    res.status(200).json({
      success: true,
      message: 'Successfully registered for the event',
    });
  }
);

/**
 * @desc    Unregister from an event
 * @route   DELETE /api/v1/students/events/:eventId/unregister
 * @access  Private (Student)
 */
export const unregisterFromEvent = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { eventId } = req.params;
    const studentId = req.student?._id;

    const [student, event] = await Promise.all([
      Student.findById(studentId),
      Event.findById(eventId),
    ]);

    if (!student) {
      throw new AppError('Student not found', 404);
    }

    if (!event) {
      throw new AppError('Event not found', 404);
    }

    // Remove from both
    student.registeredEvents = student.registeredEvents.filter(
      (id) => id.toString() !== eventId
    );
    event.registrations = event.registrations.filter(
      (id: mongoose.Types.ObjectId) => id.toString() !== studentId?.toString()
    );

    await Promise.all([student.save(), event.save()]);

    res.status(200).json({
      success: true,
      message: 'Successfully unregistered from the event',
    });
  }
);

/**
 * @desc    Get student portfolio by username (Public)
 * @route   GET /api/v1/students/portfolio/:username
 * @access  Public
 */
export const getStudentPortfolio = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { username } = req.params;

    const student = await Student.findOne({ username })
      .select('-password -emailVerificationToken -emailVerificationExpires -passwordResetToken -passwordResetExpires')
      .populate({
        path: 'registeredEvents',
        select: 'title description date location thumbnail',
      });

    if (!student) {
      throw new AppError('Student portfolio not found', 404);
    }

    res.status(200).json({
      success: true,
      data: { student },
    });
  }
);

/**
 * @desc    Delete student account
 * @route   DELETE /api/v1/students/me
 * @access  Private (Student)
 */
export const deleteAccount = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const studentId = req.student?._id;

    if (!studentId) {
      throw new AppError('Student not found', 404);
    }

    // Remove student from all registered events
    await Event.updateMany(
      { registrations: studentId },
      { $pull: { registrations: studentId } }
    );

    // Delete the student account
    await Student.findByIdAndDelete(studentId);

    // Clear cookies
    res.cookie('studentJwt', '', {
      expires: new Date(0),
      httpOnly: true,
    });
    res.cookie('studentRefreshToken', '', {
      expires: new Date(0),
      httpOnly: true,
    });

    logger.info(`Student account deleted: ${studentId}`);

    res.status(200).json({
      success: true,
      message: 'Account deleted successfully',
    });
  }
);
