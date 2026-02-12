import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { validatedConfig } from '../config/env-validation';
import { generateCsrfToken } from '../middleware/csrf';

const authService = new AuthService();

/**
 * Set httpOnly cookie with JWT token
 * httpOnly prevents JavaScript access (XSS protection)
 * Secure flag ensures HTTPS-only in production
 * SameSite=Strict provides CSRF protection
 */
function setAuthCookie(res: Response, token: string) {
  const isProduction = validatedConfig.nodeEnv === 'production';
  const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
  
  res.cookie('auth_token', token, {
    httpOnly: true, // Prevents JavaScript access (XSS protection)
    secure: isProduction, // HTTPS only in production
    sameSite: 'strict', // CSRF protection
    maxAge: maxAge,
    path: '/', // Available for all paths
  });
}

/**
 * Clear auth cookie on logout
 */
function clearAuthCookie(res: Response) {
  res.clearCookie('auth_token', {
    httpOnly: true,
    secure: validatedConfig.nodeEnv === 'production',
    sameSite: 'strict',
    path: '/',
  });
}

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email and password are required',
        } as ApiResponse);
      }

      const result = await authService.login(email, password);

      // Check if 2FA is required
      if (result.requiresTwoFactor) {
        return res.json({
          success: true,
          data: {
            requiresTwoFactor: true,
            userId: result.userId,
            email: result.email,
            message: result.message,
          },
        } as ApiResponse);
      }

      // No 2FA required - proceed with normal login
      // Set httpOnly cookie with token (secure)
      setAuthCookie(res, result.token!);

      // Generate and return CSRF token for subsequent requests
      const csrfToken = generateCsrfToken(req, res);

      // Return user and tenant data (but NOT the token in response body)
      return res.json({
        success: true,
        data: {
          user: result.user,
          tenant: result.tenant,
          csrfToken: csrfToken, // Include CSRF token in response
          // Token is now in httpOnly cookie, not in response
        },
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }

  async verifyTwoFactor(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId, code } = req.body;

      if (!userId || !code) {
        return res.status(400).json({
          success: false,
          error: 'User ID and verification code are required',
        } as ApiResponse);
      }

      // Validate code format (6 digits)
      if (!/^\d{6}$/.test(code)) {
        return res.status(400).json({
          success: false,
          error: 'Verification code must be 6 digits',
        } as ApiResponse);
      }

      const result = await authService.verifyTwoFactor(userId, code);

      // Set httpOnly cookie with token (secure)
      setAuthCookie(res, result.token);

      // Generate and return CSRF token for subsequent requests
      const csrfToken = generateCsrfToken(req, res);

      // Return user and tenant data (but NOT the token in response body)
      return res.json({
        success: true,
        data: {
          user: result.user,
          tenant: result.tenant,
          csrfToken: csrfToken, // Include CSRF token in response
          // Token is now in httpOnly cookie, not in response
        },
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }

  async resendTwoFactorCode(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'User ID is required',
        } as ApiResponse);
      }

      const result = await authService.resendTwoFactorCode(userId);

      if (!result.canResend) {
        return res.status(429).json({
          success: false,
          error: result.message || 'Please wait before requesting a new code',
        } as ApiResponse);
      }

      return res.json({
        success: true,
        data: {
          message: 'A new verification code has been sent to your email address.',
        },
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }

  async signup(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, name, companyName, role } = req.body;

      if (!email || !password || !name || !companyName) {
        return res.status(400).json({
          success: false,
          error: 'All fields are required',
        } as ApiResponse);
      }

      const result = await authService.signup({
        email,
        password,
        name,
        companyName,
        role,
      });

      // Set httpOnly cookie with token (secure)
      setAuthCookie(res, result.token);

      // Generate and return CSRF token for subsequent requests
      const csrfToken = generateCsrfToken(req, res);

      // Return user and tenant data (but NOT the token in response body)
      return res.status(201).json({
        success: true,
        data: {
          user: result.user,
          tenant: result.tenant,
          csrfToken: csrfToken, // Include CSRF token in response
          // Token is now in httpOnly cookie, not in response
        },
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }

  async getCurrentUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      const user = await authService.getCurrentUser(req.user.userId);

      // Generate CSRF token if secret exists (user is authenticated)
      let csrfToken: string | undefined;
      if (req.cookies?.csrf_secret) {
        csrfToken = generateCsrfToken(req, res);
      }

      return res.json({
        success: true,
        data: { 
          user,
          ...(csrfToken && { csrfToken }),
        },
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }

  async changePassword(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          error: 'Current password and new password are required',
        } as ApiResponse);
      }

      await authService.changePassword(req.user.userId, currentPassword, newPassword);

      return res.json({
        success: true,
        data: { message: 'Password changed successfully' },
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }

  async logout(_req: Request, res: Response, next: NextFunction) {
    try {
      // Clear the httpOnly cookie
      clearAuthCookie(res);

      // Also clear CSRF secret cookie
      res.clearCookie('csrf_secret', {
        httpOnly: true,
        secure: validatedConfig.nodeEnv === 'production',
        sameSite: 'strict',
        path: '/',
      });

      return res.json({
        success: true,
        data: { message: 'Logged out successfully' },
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }
}
