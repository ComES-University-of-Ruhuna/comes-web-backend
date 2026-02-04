// ============================================
// ComES Backend - Error Handling Middleware
// ============================================

import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

interface ErrorResponse {
  success: false;
  message: string;
  code?: string;
  errors?: Record<string, string>;
  stack?: string;
}

// Handle MongoDB CastError (invalid ObjectId)
const handleCastErrorDB = (err: mongoose.Error.CastError): AppError => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400, 'INVALID_ID');
};

// Handle MongoDB duplicate key error
const handleDuplicateFieldsDB = (err: any): AppError => {
  const value = err.errmsg?.match(/(["'])(\\?.)*?\1/)?.[0] || 'unknown';
  const message = `Duplicate field value: ${value}. Please use another value.`;
  return new AppError(message, 400, 'DUPLICATE_FIELD');
};

// Handle MongoDB validation error
const handleValidationErrorDB = (err: mongoose.Error.ValidationError): ValidationError => {
  const errors: Record<string, string> = {};
  Object.values(err.errors).forEach((el) => {
    errors[el.path] = el.message;
  });
  return new ValidationError('Validation failed', errors);
};

// Handle JWT error
const handleJWTError = (): AppError => {
  return new AppError('Invalid token. Please log in again.', 401, 'INVALID_TOKEN');
};

// Handle JWT expired error
const handleJWTExpiredError = (): AppError => {
  return new AppError('Your token has expired. Please log in again.', 401, 'TOKEN_EXPIRED');
};

// Send error response in development
const sendErrorDev = (err: AppError, res: Response): void => {
  const response: ErrorResponse = {
    success: false,
    message: err.message,
    code: err.code,
    stack: err.stack,
  };

  if (err instanceof ValidationError) {
    response.errors = err.errors;
  }

  res.status(err.statusCode).json(response);
};

// Send error response in production
const sendErrorProd = (err: AppError, res: Response): void => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    const response: ErrorResponse = {
      success: false,
      message: err.message,
      code: err.code,
    };

    if (err instanceof ValidationError) {
      response.errors = err.errors;
    }

    res.status(err.statusCode).json(response);
  } else {
    // Programming or unknown error: don't leak error details
    logger.error('ERROR 💥:', err);

    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again later.',
      code: 'INTERNAL_ERROR',
    });
  }
};

// Global error handler middleware
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let error: AppError;

  if (err instanceof AppError) {
    error = err;
  } else {
    // Convert unknown errors to AppError
    error = new AppError(err.message || 'Internal Server Error', 500);
    error.stack = err.stack;
  }

  // Log error
  logger.error(`${error.statusCode} - ${error.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);

  // Handle specific error types
  if (err.name === 'CastError') {
    error = handleCastErrorDB(err as mongoose.Error.CastError);
  }
  if ((err as any).code === 11000) {
    error = handleDuplicateFieldsDB(err);
  }
  if (err.name === 'ValidationError') {
    error = handleValidationErrorDB(err as mongoose.Error.ValidationError);
  }
  if (err.name === 'JsonWebTokenError') {
    error = handleJWTError();
  }
  if (err.name === 'TokenExpiredError') {
    error = handleJWTExpiredError();
  }

  // Send response based on environment
  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(error, res);
  } else {
    sendErrorProd(error, res);
  }
};

// 404 Not Found handler
export const notFound = (req: Request, res: Response, next: NextFunction): void => {
  const error = new AppError(`Cannot find ${req.originalUrl} on this server`, 404, 'NOT_FOUND');
  next(error);
};
