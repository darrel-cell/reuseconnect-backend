import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import prisma from '../config/database';
import { AuthenticatedRequest, ApiResponse } from '../types';

const router = Router();

router.use(authenticate);

// Get asset categories (all authenticated users can view - they're global)
router.get(
  '/',
  authorize('admin', 'client', 'reseller', 'driver'),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      // Asset categories are global - no tenant filtering
      const categories = await prisma.assetCategory.findMany({
        orderBy: { name: 'asc' },
      });

      return res.json({
        success: true,
        data: categories,
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }
);

// Create asset category (admin only)
router.post(
  '/',
  authorize('admin'),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      const { name, icon, co2ePerUnit, avgWeight, avgBuybackValue } = req.body;

      // Check if category with same name already exists (global categories must be unique)
      const existing = await prisma.assetCategory.findUnique({
        where: { name },
      });

      if (existing) {
        return res.status(409).json({
          success: false,
          error: 'Category with this name already exists',
        } as ApiResponse);
      }

      const category = await prisma.assetCategory.create({
        data: {
          name,
          icon,
          co2ePerUnit: parseFloat(co2ePerUnit),
          avgWeight: parseFloat(avgWeight),
          avgBuybackValue: parseFloat(avgBuybackValue),
        },
      });

      return res.status(201).json({
        success: true,
        data: category,
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }
);

export default router;

