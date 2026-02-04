// ============================================
// ComES Backend - Authentication Middleware
// ============================================

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/user.model';
import { asyncHandler, AuthenticationError, AuthorizationError } from '../utils';
import config from '../config';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

interface JwtPayload {
  id: string;
  iat: number;
  exp: number;
}

/**
 * Protect routes - require authentication
 */
export const protect = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    let token: string | undefined;

    // Check for token in Authorization header
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    // Check for token in cookies
    else if (req.cookies?.jwt) {
      token = req.cookies.jwt;
    }

    if (!token) {
      throw new AuthenticationError('You are not logged in. Please log in to access this resource.');
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;

      // Check if user still exists
      const currentUser = await User.findById(decoded.id).select('+passwordChangedAt');

      if (!currentUser) {
        throw new AuthenticationError('The user belonging to this token no longer exists.');
      }

      // Check if user changed password after the token was issued
      if (currentUser.changedPasswordAfter(decoded.iat)) {
        throw new AuthenticationError('User recently changed password. Please log in again.');
      }

      // Check if user is active
      if (!currentUser.isActive) {
        throw new AuthenticationError('This account has been deactivated.');
      }

      // Grant access to protected route
      req.user = currentUser;
      next();
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthenticationError('Invalid token. Please log in again.');
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthenticationError('Your token has expired. Please log in again.');
      }
      throw error;
    }
  }
);

/**
 * Optional authentication - doesn't require auth but populates user if token exists
 */
export const optionalAuth = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    let token: string | undefined;

    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.jwt) {
      token = req.cookies.jwt;
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
        const currentUser = await User.findById(decoded.id);

        if (currentUser && currentUser.isActive) {
          req.user = currentUser;
        }
      } catch {
        // Token invalid or expired - continue without user
      }
    }

    next();
  }
);

/**
 * Restrict to specific roles
 */
export const restrictTo = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AuthenticationError('You must be logged in to access this resource.');
    }

    if (!roles.includes(req.user.role)) {
      throw new AuthorizationError('You do not have permission to perform this action.');
    }

    next();
  };
};

/**
 * Check if user owns the resource or is admin
 */
export const ownerOrAdmin = (getOwnerId: (req: Request) => string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AuthenticationError('You must be logged in to access this resource.');
    }

    const ownerId = getOwnerId(req);
    const isOwner = req.user._id.toString() === ownerId;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      throw new AuthorizationError('You do not have permission to perform this action.');
    }

    next();
  };
};
