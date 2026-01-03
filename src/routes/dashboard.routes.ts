import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
const dashboardController = new DashboardController();

router.use(authenticate);

router.get(
  '/stats',
  authorize('admin', 'client', 'reseller', 'driver'),
  dashboardController.getStats.bind(dashboardController)
);

export default router;

