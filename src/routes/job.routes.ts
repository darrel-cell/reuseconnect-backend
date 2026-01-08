import { Router } from 'express';
import { JobController } from '../controllers/job.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
const jobController = new JobController();

// All routes require authentication
router.use(authenticate);

// List jobs
router.get(
  '/',
  authorize('admin', 'client', 'reseller', 'driver'),
  jobController.list.bind(jobController)
);

// Get job by ID
router.get(
  '/:id',
  authorize('admin', 'client', 'reseller', 'driver'),
  jobController.getById.bind(jobController)
);

// Update job status (driver, admin)
router.patch(
  '/:id/status',
  authorize('admin', 'driver'),
  jobController.updateStatus.bind(jobController)
);

// Update job evidence (driver)
router.patch(
  '/:id/evidence',
  authorize('admin', 'driver'),
  jobController.updateEvidence.bind(jobController)
);

// Update driver journey fields (driver only, for routed status)
router.patch(
  '/:id/journey-fields',
  authorize('admin', 'driver'),
  jobController.updateJourneyFields.bind(jobController)
);

export default router;
