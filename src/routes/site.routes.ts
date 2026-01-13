// Site Routes
import { Router } from 'express';
import { SiteController } from '../controllers/site.controller';
import { authenticate } from '../middleware/auth';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validator';

const router = Router();
const siteController = new SiteController();

// Get all sites (authenticated users only)
router.get(
  '/',
  authenticate,
  validate([
    query('clientId').optional().isUUID().withMessage('clientId must be a valid UUID'),
  ]),
  siteController.getSites.bind(siteController)
);

// Get site by ID (authenticated users only)
router.get(
  '/:id',
  authenticate,
  validate([
    param('id').isUUID().withMessage('Site ID must be a valid UUID'),
  ]),
  siteController.getSiteById.bind(siteController)
);

// Create a new site (authenticated users only)
router.post(
  '/',
  authenticate,
  validate([
    body('name').notEmpty().withMessage('Site name is required'),
    body('address').notEmpty().withMessage('Address is required'),
    body('postcode').notEmpty().withMessage('Postcode is required'),
    body('lat').optional().isFloat().withMessage('Latitude must be a number'),
    body('lng').optional().isFloat().withMessage('Longitude must be a number'),
    body('contactName').optional().isString(),
    body('contactPhone').optional().isString(),
    body('clientId').optional().isUUID().withMessage('clientId must be a valid UUID'),
  ]),
  siteController.createSite.bind(siteController)
);

// Update a site (authenticated users only)
router.put(
  '/:id',
  authenticate,
  validate([
    param('id').isUUID().withMessage('Site ID must be a valid UUID'),
    body('name').optional().notEmpty().withMessage('Site name cannot be empty'),
    body('address').optional().notEmpty().withMessage('Address cannot be empty'),
    body('postcode').optional().notEmpty().withMessage('Postcode cannot be empty'),
    body('lat').optional().isFloat().withMessage('Latitude must be a number'),
    body('lng').optional().isFloat().withMessage('Longitude must be a number'),
    body('contactName').optional().isString(),
    body('contactPhone').optional().isString(),
  ]),
  siteController.updateSite.bind(siteController)
);

// Delete a site (authenticated users only)
router.delete(
  '/:id',
  authenticate,
  validate([
    param('id').isUUID().withMessage('Site ID must be a valid UUID'),
  ]),
  siteController.deleteSite.bind(siteController)
);

export default router;
