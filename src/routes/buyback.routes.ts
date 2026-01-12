// Buyback Routes
import { Router } from 'express';
import { BuybackController } from '../controllers/buyback.controller';
import { authenticate } from '../middleware/auth';
import { body } from 'express-validator';
import { validate } from '../middleware/validator';

const router = Router();
const buybackController = new BuybackController();

// Calculate buyback estimate (authenticated users only)
router.post(
  '/calculate',
  authenticate,
  validate([
    body('assets').isArray({ min: 1 }).withMessage('Assets array is required with at least one item'),
    body('assets.*.categoryId').notEmpty().withMessage('Each asset must have a categoryId'),
    body('assets.*.quantity').isFloat({ min: 0.01 }).withMessage('Each asset must have a quantity > 0'),
  ]),
  buybackController.calculateBuyback.bind(buybackController)
);

export default router;
