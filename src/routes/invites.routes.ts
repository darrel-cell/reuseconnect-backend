import { Router } from 'express';
import { InviteController } from '../controllers/invite.controller';
import { authenticate, authorize } from '../middleware/auth';
import { body } from 'express-validator';
import { validate } from '../middleware/validator';

const router = Router();
const inviteController = new InviteController();

// List invitations (admin and reseller only - see invitations they sent)
router.get(
  '/',
  authenticate,
  authorize('admin', 'reseller'),
  inviteController.listInvites.bind(inviteController)
);

// Create invitation (admin and reseller only)
router.post(
  '/',
  authenticate,
  authorize('admin', 'reseller'),
  validate([
    body('email').isEmail().withMessage('Valid email is required'),
    body('role').isIn(['client', 'reseller', 'driver']).withMessage('Role must be client, reseller, or driver'),
  ]),
  inviteController.createInvite.bind(inviteController)
);

// Cancel/Delete invitation (admin and reseller only - can cancel invitations they sent)
router.delete(
  '/:id',
  authenticate,
  authorize('admin', 'reseller'),
  inviteController.cancelInvite.bind(inviteController)
);

// Get invitation by token (public, no auth required)
router.get(
  '/token/:token',
  inviteController.getInviteByToken.bind(inviteController)
);

// Accept invitation (public, no auth required)
router.post(
  '/accept',
  validate([
    body('inviteToken').notEmpty().withMessage('Invite token is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('name').notEmpty().withMessage('Name is required'),
    body('password')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
      .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
      .matches(/\d/).withMessage('Password must contain at least one number'),
  ]),
  inviteController.acceptInvite.bind(inviteController)
);

export default router;

