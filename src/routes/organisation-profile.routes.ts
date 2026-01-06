import express from 'express';
import { OrganisationProfileController } from '../controllers/organisation-profile.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { body } from 'express-validator';

const router = express.Router();
const profileController = new OrganisationProfileController();

// All routes require authentication
router.use(authenticate);

// Get organisation profile
router.get('/', profileController.getProfile.bind(profileController));

// Create or update organisation profile
router.patch(
  '/',
  validate([
    body('organisationName').notEmpty().withMessage('Organisation name is required'),
    body('registrationNumber').notEmpty().withMessage('Registration number is required'),
    body('address').notEmpty().withMessage('Address is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('phone').notEmpty().withMessage('Phone number is required'),
  ]),
  profileController.upsertProfile.bind(profileController)
);

// Check if profile is complete
router.get('/complete', profileController.checkProfileComplete.bind(profileController));

export default router;

