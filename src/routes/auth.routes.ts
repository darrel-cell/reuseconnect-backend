import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { body } from 'express-validator';
import { validate } from '../middleware/validator';
import { generateCsrfToken } from '../middleware/csrf';
import { ApiResponse } from '../types';

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
      .matches(/\d/).withMessage('Password must contain at least one number'),
    body('name').notEmpty().withMessage('Name is required'),
    body('companyName').notEmpty().withMessage('Company name is required'),
  ]),
  authController.signup.bind(authController)
);

router.get(
  '/me',
  authenticate,
  authController.getCurrentUser.bind(authController)
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
      .matches(/\d/).withMessage('Password must contain at least one number'),
  ]),
  authController.changePassword.bind(authController)
);

router.post(
  '/logout',
  authController.logout.bind(authController)
);

// Get CSRF token endpoint (for authenticated users)
router.get(
  '/csrf-token',
  authenticate,
  (req, res) => {
    const token = generateCsrfToken(req, res);
    return res.json({
      success: true,
      data: { csrfToken: token },
    } as ApiResponse);
  }
);

export default router;
