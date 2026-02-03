import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { JWTPayload } from '../types';

export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  } as jwt.SignOptions);
}

export function verifyToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

export function extractTokenFromHeader(authHeader?: string): string | null {
  if (!authHeader) return null;
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  
  return parts[1];
}

/**
 * Extract token from cookie (preferred method for security)
 */
export function extractTokenFromCookie(cookie?: string): string | null {
  if (!cookie) return null;
  
  // Cookie format: "auth_token=value; other=value"
  const match = cookie.match(/auth_token=([^;]+)/);
  return match ? match[1] : null;
}

/**
 * Extract token from request (tries cookie first, then header for backward compatibility)
 */
export function extractTokenFromRequest(req: { cookies?: { auth_token?: string }; headers?: { authorization?: string; cookie?: string } }): string | null {
  // Try cookie first (secure method)
  if (req.cookies?.auth_token) {
    return req.cookies.auth_token;
  }
  
  // Fallback to cookie header (for cases where cookie-parser might not have parsed it)
  if (req.headers?.cookie) {
    const token = extractTokenFromCookie(req.headers.cookie);
    if (token) return token;
  }
  
  // Fallback to Authorization header (for backward compatibility during migration)
  if (req.headers?.authorization) {
    return extractTokenFromHeader(req.headers.authorization);
  }
  
  return null;
}