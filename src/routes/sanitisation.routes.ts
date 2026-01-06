import { Router } from 'express';
import { SanitisationController } from '../controllers/sanitisation.controller';
import { authenticate, requireAdmin, allowAdminOrBookingOwner } from '../middleware/auth';

const router = Router();
const sanitisationController = new SanitisationController();

// All routes require authentication
router.use(authenticate);

// Get sanitisation records (admin or booking owner can view)
router.get(
  '/',
  allowAdminOrBookingOwner,
  sanitisationController.getRecords.bind(sanitisationController)
);

// Create sanitisation record (admin only)
router.post(
  '/',
  requireAdmin,
  sanitisationController.createRecord.bind(sanitisationController)
);

// Verify sanitisation record (admin only)
router.post(
  '/:id/verify',
  requireAdmin,
  sanitisationController.verifyRecord.bind(sanitisationController)
);

export default router;

