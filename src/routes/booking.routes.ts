import { Router } from 'express';
import { BookingController } from '../controllers/booking.controller';
import { authenticate, authorize, requireAdmin } from '../middleware/auth';

const router = Router();
const bookingController = new BookingController();

// All routes require authentication
router.use(authenticate);

// Create booking (admin, client, reseller)
router.post(
  '/',
  authorize('admin', 'client', 'reseller'),
  bookingController.create.bind(bookingController)
);

// List bookings
router.get(
  '/',
  authorize('admin', 'client', 'reseller'),
  bookingController.list.bind(bookingController)
);

// Get booking by ID
router.get(
  '/:id',
  authorize('admin', 'client', 'reseller'),
  bookingController.getById.bind(bookingController)
);

// Assign driver (admin only)
router.post(
  '/:id/assign-driver',
  requireAdmin,
  bookingController.assignDriver.bind(bookingController)
);

// Update booking status (admin only)
router.patch(
  '/:id/status',
  requireAdmin,
  bookingController.updateStatus.bind(bookingController)
);

export default router;
