import { Request, Response, NextFunction } from 'express';
import csrf from 'csrf';
import { ApiResponse } from '../types';
import { validatedConfig } from '../config/env-validation';

// Create CSRF instance
const tokens = new csrf();

/**
 * CSRF protection middleware
 * Validates CSRF token from request header or body
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Skip CSRF for GET, HEAD, OPTIONS requests (read-only)
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip CSRF for public endpoints that don't require authentication
  // Check both full URL path and relative path (since middleware is mounted at /api/)
  const fullPath = req.originalUrl?.split('?')[0] || '';
  const relativePath = req.path;
  
  // Public endpoints that don't require CSRF protection
  const publicEndpoints = [
    '/api/auth/login',
    '/api/auth/signup',
    '/api/invites/token',
    '/api/invites/accept',
    '/health',
    '/auth/login',      // Relative path when mounted at /api/
    '/auth/signup',     // Relative path when mounted at /api/
    '/invites/token',   // Relative path when mounted at /api/
    '/invites/accept',  // Relative path when mounted at /api/
  ];
  
  // Check if the request path matches any public endpoint
  const isPublicEndpoint = publicEndpoints.some(endpoint => 
    fullPath.startsWith(endpoint) || relativePath.startsWith(endpoint)
  );
  
  if (isPublicEndpoint) {
    return next();
  }

  // Get CSRF token from header (preferred) or body
  const token = req.headers['x-csrf-token'] as string || req.body?._csrf;

  if (!token) {
    return res.status(403).json({
      success: false,
      error: 'CSRF token missing',
    } as ApiResponse);
  }

  // Get secret from cookie
  const secret = req.cookies?.csrf_secret;

  if (!secret) {
    return res.status(403).json({
      success: false,
      error: 'CSRF secret not found. Please refresh the page.',
    } as ApiResponse);
  }

  // Verify token
  if (!tokens.verify(secret, token)) {
    return res.status(403).json({
      success: false,
      error: 'Invalid CSRF token',
    } as ApiResponse);
  }

  next();
}

/**
 * Generate and return CSRF token
 * Should be called after authentication to get a token for subsequent requests
 */
export function generateCsrfToken(req: Request, res: Response): string {
  // Use existing secret from cookie or generate/store new one
  let secret = req.cookies?.csrf_secret;
  
  if (!secret) {
    // Generate new secret
    secret = tokens.secretSync();
    // Store in httpOnly cookie
    const isProduction = validatedConfig.nodeEnv === 'production';
    res.cookie('csrf_secret', secret, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (same as auth token)
      path: '/',
    });
  }

  // Generate token from secret
  return tokens.create(secret);
}
