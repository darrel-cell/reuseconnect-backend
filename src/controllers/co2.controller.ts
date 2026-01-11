// CO2 Controller
import { Response } from 'express';
import { CO2Service } from '../services/co2.service';
import { AuthenticatedRequest } from '../types';
import { ApiResponse } from '../types';

const co2Service = new CO2Service();

export class CO2Controller {
  /**
   * Calculate CO2e for a booking request
   */
  async calculateCO2e(req: AuthenticatedRequest, res: Response) {
    try {
      const { assets, collectionLat, collectionLng, distanceKm, vehicleType } = req.body;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

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

      const result = await co2Service.calculateBookingCO2e({
        assets,
        collectionLat,
        collectionLng,
        distanceKm,
        vehicleType,
        tenantId,
      });

      return res.json({
        success: true,
        data: result,
      } as ApiResponse);
    } catch (error) {
      const { logger } = await import('../utils/logger');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error('Error calculating CO2e', {
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
