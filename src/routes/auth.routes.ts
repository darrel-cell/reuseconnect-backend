import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { body } from 'express-validator';
import { validate } from '../middleware/validator';
import { generateCsrfToken } from '../middleware/csrf';
import { ApiResponse, AuthenticatedRequest } from '../types';
import { extractTokenFromRequest, verifyToken } from '../utils/jwt';

const router = Router();
const authController = new AuthController();

router.post(
  '/login',
  validate([
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ]),
  authController.login.bind(authController)
);

router.post(
  '/signup',
  validate([
    body('email').isEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
      .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
      .matches(/\d/).withMessage('Password must contain at least one number')
      .matches(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/).withMessage('Password must contain at least one special character'),
    body('name').notEmpty().withMessage('Name is required'),
    body('companyName').notEmpty().withMessage('Company name is required'),
  ]),
  authController.signup.bind(authController)
);

router.post(
  '/verify-2fa',
  validate([
    body('userId').notEmpty().withMessage('User ID is required'),
    body('code').matches(/^\d{6}$/).withMessage('Verification code must be 6 digits'),
  ]),
  authController.verifyTwoFactor.bind(authController)
);

router.post(
  '/resend-2fa',
  validate([
    body('userId').notEmpty().withMessage('User ID is required'),
  ]),
  authController.resendTwoFactorCode.bind(authController)
);

// Get current user endpoint
// Returns user if authenticated, null if not authenticated (to avoid 401 console errors)
router.get(
  '/me',
  // Check authentication without throwing error - return null user if not authenticated
  async (req: AuthenticatedRequest, res, next) => {
    try {
      // Try to extract and verify token without throwing
      const token = extractTokenFromRequest(req);
      
      if (token) {
        try {
          const payload = verifyToken(token);
          req.user = payload;
          
          // User is authenticated - call the controller method
          return authController.getCurrentUser(req, res, next);
        } catch (error) {
          // Token invalid or expired - return null user (200 OK to avoid console errors)
        }
      }
      
      // Not authenticated - return null user (200 OK to avoid console errors)
      return res.json({
        success: true,
        data: { user: null },
      } as ApiResponse);
    } catch (error) {
      // If anything fails, return null user instead of 401
      return res.json({
        success: true,
        data: { user: null },
      } as ApiResponse);
    }
  }
);

router.post(
  '/change-password',
  authenticate,
  validate([
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
      .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
      .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
      .matches(/\d/).withMessage('Password must contain at least one number')
      .matches(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/).withMessage('Password must contain at least one special character'),
  ]),
  authController.changePassword.bind(authController)
);

router.post(
  '/logout',
  authController.logout.bind(authController)
);

// Get CSRF token endpoint
// Returns CSRF token if authenticated, null if not authenticated (to avoid 401 console errors)
router.get(
  '/csrf-token',
  // Check authentication without throwing error - return null token if not authenticated
  (req: AuthenticatedRequest, res) => {
    try {
      // Try to extract and verify token without throwing
      const token = extractTokenFromRequest(req);
      
      if (token) {
        try {
          const payload = verifyToken(token);
          req.user = payload;
          
          // User is authenticated - generate and return CSRF token
          const csrfToken = generateCsrfToken(req, res);
          return res.json({
            success: true,
            data: { csrfToken },
          } as ApiResponse);
        } catch (error) {
          // Token invalid or expired - return null token (200 OK to avoid console errors)
        }
      }
      
      // Not authenticated - return null token (200 OK to avoid console errors)
      return res.json({
        success: true,
        data: { csrfToken: null },
      } as ApiResponse);
    } catch (error) {
      // If anything fails, return null token instead of 401
      return res.json({
        success: true,
        data: { csrfToken: null },
      } as ApiResponse);
    }
  }
);

export default router;
