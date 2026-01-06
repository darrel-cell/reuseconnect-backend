import { Router } from 'express';
import { GradingController } from '../controllers/grading.controller';
import { authenticate, requireAdmin, allowAdminOrBookingOwner } from '../middleware/auth';

const router = Router();
const gradingController = new GradingController();

// All routes require authentication
router.use(authenticate);

// Get grading records (admin or booking owner can view)
router.get(
  '/',
  allowAdminOrBookingOwner,
  gradingController.getRecords.bind(gradingController)
);

// Create grading record (admin only)
router.post(
  '/',
  requireAdmin,
  gradingController.createRecord.bind(gradingController)
);

// Calculate resale value (admin only)
router.get(
  '/calculate-resale-value',
  requireAdmin,
  gradingController.calculateResaleValue.bind(gradingController)
);

export default router;

