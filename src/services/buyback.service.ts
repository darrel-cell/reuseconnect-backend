// Buyback Calculation Service
// Uses database values for buyback calculation

import prisma from '../config/database';
import { logger } from '../utils/logger';

export class BuybackService {
  /**
   * Calculate buyback estimate for assets
   * Uses database values for RRP, residual percentages, volume factors, floors, and caps
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

      // Get buyback config (singleton)
      const config = await prisma.buybackConfig.findUnique({
        where: { id: 'singleton' },
      });

      if (!config) {
        // Use defaults if config doesn't exist
        logger.warn('BuybackConfig not found, using default values');
      }

      const volumeFactor10 = config?.volumeFactor10 ?? 1.03;
      const volumeFactor50 = config?.volumeFactor50 ?? 1.06;
      const volumeFactor200 = config?.volumeFactor200 ?? 1.10;
      const ageFactor = config?.ageFactor ?? 1.0;
      const conditionFactor = config?.conditionFactor ?? 1.0;
      const marketFactor = config?.marketFactor ?? 1.0;

      // Calculate volume factor based on quantity
      const getVolumeFactor = (quantity: number): number => {
        if (quantity >= 200) return volumeFactor200;
        if (quantity >= 50) return volumeFactor50;
        if (quantity >= 10) return volumeFactor10;
        return 1.00; // 1-9 items
      };

      // Calculate total buyback
      let totalBuyback = 0;

      for (const asset of data.assets) {
        const category = categories.find(c => c.id === asset.categoryId);
        
        if (!category) {
          logger.warn(`Category not found for categoryId: ${asset.categoryId}`);
          continue;
        }

        // Use database values, with fallback to avgBuybackValue if new fields are null
        let baseBuyback: number;
        
        if (category.avgRRP != null && category.residualLow != null) {
          // Use new database fields
          baseBuyback = category.avgRRP * category.residualLow;
        } else if (category.avgBuybackValue != null && category.avgBuybackValue > 0) {
          // Fallback to avgBuybackValue (base value)
          baseBuyback = category.avgBuybackValue;
        } else {
          logger.warn(`No buyback values found for category: ${category.name}`);
          continue;
        }

        // Get volume factor for this quantity
        const volumeFactor = getVolumeFactor(asset.quantity);

        // Calculate buyback per unit
        // Formula: (RRP × residual_low %) × volume_factor × age_factor × condition_factor × market_factor
        const rawBuybackPerUnit = baseBuyback * ageFactor * conditionFactor * volumeFactor * marketFactor;

        // Apply floor and cap from database
        const floor = category.buybackFloor ?? 0;
        const cap = category.buybackCap ?? Infinity;

        const buybackPerUnit = Math.max(floor, Math.min(cap, rawBuybackPerUnit));

        // Add to total (per unit × quantity)
        totalBuyback += buybackPerUnit * asset.quantity;
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
