// Custom error classes

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public fields?: Record<string, string>) {
    super(400, message, true);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(400, message, true);
    Object.setPrototypeOf(this, BadRequestError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(404, id ? `${resource} with ID "${id}" not found` : `${resource} not found`, true);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, message, true);
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(403, message, true);
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

// Error handler middleware
import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types';
import { logger, logError } from './logger';

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const requestId = req.id || 'unknown';

  if (err instanceof AppError) {
    // Log operational errors at appropriate level
    if (err.statusCode >= 500) {
      logError('Application error', err, { requestId, statusCode: err.statusCode });
    } else {
      logger.warn('Client error', {
        requestId,
        statusCode: err.statusCode,
        message: err.message,
        ...(err instanceof ValidationError && { fields: err.fields }),
      });
    }

    const response: ApiResponse = {
      success: false,
      error: err.message,
    };
    return res.status(err.statusCode).json(response);
  }

  // Unknown/unhandled error
  logError('Unhandled error', err, { 
    requestId,
    method: req.method,
    path: req.path,
    body: req.body,
    query: req.query,
  });

  const response: ApiResponse = {
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
  };
  return res.status(500).json(response);
}

