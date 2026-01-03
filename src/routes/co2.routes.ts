// CO2 Routes
import { Router } from 'express';
import { CO2Controller } from '../controllers/co2.controller';
import { authenticate, authorize } from '../middleware/auth';
import { body } from 'express-validator';
import { validate } from '../middleware/validator';

const router = Router();
const co2Controller = new CO2Controller();

// Calculate CO2e (authenticated users only)
router.post(
  '/calculate',
  authenticate,
  validate([
    body('assets').isArray({ min: 1 }).withMessage('Assets array is required with at least one item'),
    body('assets.*.categoryId').notEmpty().withMessage('Each asset must have a categoryId'),
    body('assets.*.quantity').isFloat({ min: 0.01 }).withMessage('Each asset must have a quantity > 0'),
    body('collectionLat').optional().isFloat().withMessage('Collection latitude must be a valid number'),
    body('collectionLng').optional().isFloat().withMessage('Collection longitude must be a valid number'),
    body('distanceKm').optional().isFloat({ min: 0 }).withMessage('Distance must be a valid positive number'),
    body('vehicleType').optional().isIn(['petrol', 'diesel', 'electric', 'car', 'van', 'truck']).withMessage('Invalid vehicle type'),
  ]),
  co2Controller.calculateCO2e.bind(co2Controller)
);

export default router;
