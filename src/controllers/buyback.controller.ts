// Buyback Controller
import { Response } from 'express';
import { BuybackService } from '../services/buyback.service';
import { AuthenticatedRequest } from '../types';
import { ApiResponse } from '../types';

const buybackService = new BuybackService();

export class BuybackController {
  /**
   * Calculate buyback estimate for assets
   */
  async calculateBuyback(req: AuthenticatedRequest, res: Response) {
    try {
      const { assets } = req.body;

      if (!assets || !Array.isArray(assets) || assets.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Assets array is required and must not be empty',
        } as ApiResponse);
      }

      // Validate assets structure
      for (const asset of assets) {
        if (!asset.categoryId || typeof asset.quantity !== 'number' || asset.quantity <= 0) {
          return res.status(400).json({
            success: false,
            error: 'Each asset must have a valid categoryId and quantity > 0',
          } as ApiResponse);
        }
      }

      const estimatedBuyback = await buybackService.calculateBuybackEstimate({
        assets,
      });

      return res.json({
        success: true,
        data: {
          estimatedBuyback,
        },
      } as ApiResponse);
    } catch (error) {
      const { logger } = await import('../utils/logger');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error('Error calculating buyback', {
        error: errorMessage,
        stack: errorStack,
      });
      
      // Include stack trace in development for debugging
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      return res.status(500).json({
        success: false,
        error: errorMessage,
        ...(isDevelopment && errorStack && { stack: errorStack }),
      } as ApiResponse);
    }
  }
}
