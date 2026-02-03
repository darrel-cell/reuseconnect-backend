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

/**
 * List of sensitive field names that should be excluded from logs
 */
const SENSITIVE_FIELDS = [
  'password',
  'currentPassword',
  'newPassword',
  'confirmPassword',
  'token',
  'authToken',
  'accessToken',
  'refreshToken',
  'apiKey',
  'apiSecret',
  'secret',
  'secretKey',
  'privateKey',
  'authorization',
  'authorizationToken',
  'jwt',
  'jwtToken',
  'sessionToken',
  'sessionId',
  'cookie',
  'cookies',
];

/**
 * Sanitizes an object by removing or masking sensitive fields
 * @param obj - The object to sanitize
 * @param depth - Maximum depth to recurse (prevents infinite loops)
 * @returns Sanitized copy of the object
 */
function sanitizeObject(obj: any, depth: number = 5): any {
  if (depth <= 0 || obj === null || obj === undefined) {
    return '[Max depth reached or null/undefined]';
  }

  // Handle primitives
  if (typeof obj !== 'object') {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth - 1));
  }

  // Handle objects
  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    
    // Check if this field is sensitive
    if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeObject(value, depth - 1);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

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

    // Include field-specific errors for ValidationError
    if (err instanceof ValidationError && err.fields) {
      response.fields = err.fields;
      // If there's a single field error, use it as the main error message for clarity
      const fieldErrors = Object.values(err.fields);
      if (fieldErrors.length === 1) {
        response.error = fieldErrors[0];
      } else if (fieldErrors.length > 1) {
        // Combine multiple field errors into a readable message
        response.error = fieldErrors.join('; ');
      }
    }

    return res.status(err.statusCode).json(response);
  }

  // Unknown/unhandled error - sanitize sensitive data before logging
  logError('Unhandled error', err, { 
    requestId,
    method: req.method,
    path: req.path,
    body: sanitizeObject(req.body),
    query: sanitizeObject(req.query),
  });

  const response: ApiResponse = {
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
  };
  return res.status(500).json(response);
}

