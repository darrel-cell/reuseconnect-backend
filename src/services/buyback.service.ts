// Buyback Calculation Service
// Simple buyback estimate: buybackFloor × quantity
// For client-facing estimates with 3+ year assets, B/C grade only

import prisma from '../config/database';
import { logger } from '../utils/logger';

export class BuybackService {
  /**
   * Calculate buyback estimate for assets
   * Simple formula: buybackFloor × quantity
   * 
   * Note: Final buyback will be updated after processing/testing
   */
  async calculateBuybackEstimate(data: {
    assets: Array<{ categoryId: string; quantity: number }>;
  }): Promise<number> {
    try {
      // Get asset categories from database
      const categories = await prisma.assetCategory.findMany({
        orderBy: { name: 'asc' },
      });

      if (categories.length === 0) {
        throw new Error('No asset categories found');
      }

      // Calculate total buyback
      let totalBuyback = 0;

      for (const asset of data.assets) {
        const category = categories.find(c => c.id === asset.categoryId);
        
        if (!category) {
          logger.warn(`Category not found for categoryId: ${asset.categoryId}`);
          continue;
        }

        // Get buybackFloor from database
        const buybackFloor = category.buybackFloor;

        if (buybackFloor === null || buybackFloor === undefined) {
          logger.warn(`No buybackFloor defined for category: ${category.name}`);
          continue;
        }

        // Simple calculation: buybackFloor × quantity
        const buybackForAsset = buybackFloor * asset.quantity;
        totalBuyback += buybackForAsset;
      }

      return Math.round(totalBuyback * 100) / 100; // Round to 2 decimal places
    } catch (error) {
      logger.error('Error calculating buyback estimate', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }
}
