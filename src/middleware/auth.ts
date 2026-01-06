import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractTokenFromHeader } from '../utils/jwt';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { AuthenticatedRequest, UserRole } from '../types';

/**
 * Middleware to authenticate JWT token
 */
export function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);
    
    if (!token) {
      throw new UnauthorizedError('No token provided');
    }

    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (error) {
    next(new UnauthorizedError('Invalid or expired token'));
  }
}

/**
 * Middleware to check if user has required role(s)
 */
export function authorize(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError('Insufficient permissions'));
    }

    next();
  };
}

/**
 * Middleware to check if user is admin
 */
export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required'));
  }

  if (req.user.role !== 'admin') {
    return next(new ForbiddenError('Admin access required'));
  }

  next();
}

/**
 * Middleware to check if user owns resource or is admin
 */
export function requireOwnershipOrAdmin(tenantIdField = 'tenantId') {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    // Admin can access any resource
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user's tenant matches resource tenant
    const resourceTenantId = (req.body as any)[tenantIdField] || 
                             (req.params as any)[tenantIdField] ||
                             (req.query as any)[tenantIdField];

    if (resourceTenantId && resourceTenantId !== req.user.tenantId) {
      return next(new ForbiddenError('Access denied to this resource'));
    }

    next();
  };
}

/**
 * Middleware to allow admins and booking owners (clients/resellers) to view records
 * This is used for GET endpoints that should be viewable by booking owners
 */
export function allowAdminOrBookingOwner(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required'));
  }

  // Admin can access any resource
  if (req.user.role === 'admin') {
    return next();
  }

  // For clients and resellers, we'll check booking ownership in the controller
  // This middleware just allows them to proceed to the controller
  if (['client', 'reseller'].includes(req.user.role)) {
    return next();
  }

  // Other roles are not allowed
  return next(new ForbiddenError('Access denied'));
}