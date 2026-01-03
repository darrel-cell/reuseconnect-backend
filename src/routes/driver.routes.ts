import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { DriverController } from '../controllers/driver.controller';

const router = Router();
const driverController = new DriverController();

router.use(authenticate);

// Get all drivers (admin only)
router.get(
  '/',
  authorize('admin'),
  (req, res, next) => driverController.list(req, res, next)
);

// Get driver by ID
// - Admin: can view any driver in their tenant
// - Driver: can only view their own record
router.get(
  '/:id',
  authorize('admin', 'driver'),
  (req, res, next) => driverController.getById(req, res, next)
);

// Create or update driver profile (admin or driver themselves)
router.post(
  '/profile',
  authorize('admin', 'driver'),
  (req, res, next) => driverController.createProfile(req, res, next)
);

// Update driver profile (admin or driver themselves)
router.patch(
  '/:id/profile',
  authorize('admin', 'driver'),
  (req, res, next) => driverController.updateProfile(req, res, next)
);

// Delete driver profile (admin only)
router.delete(
  '/:id/profile',
  authorize('admin'),
  (req, res, next) => driverController.deleteProfile(req, res, next)
);

export default router;
