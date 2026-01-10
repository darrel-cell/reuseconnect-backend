// CO2 Calculation Service

import { calculateCO2e, calculateRoundTripDistance, calculateBuybackEstimate } from '../utils/co2';
import { config } from '../config/env';
import prisma from '../config/database';

export class CO2Service {
  /**
   * Calculate CO2e for a booking request
   */
  async calculateBookingCO2e(data: {
    assets: Array<{ categoryId: string; quantity: number }>;
    collectionLat?: number;
    collectionLng?: number;
    distanceKm?: number;
    vehicleType?: 'petrol' | 'diesel' | 'electric';
    tenantId: string;
  }) {
    // Get asset categories from database (global - no tenant filtering)
    const categories = await prisma.assetCategory.findMany({
      orderBy: { name: 'asc' },
    });

    if (categories.length === 0) {
      throw new Error('No asset categories found');
    }

    // Calculate distance using road distance (async)
    let distanceKm = data.distanceKm;
    if (!distanceKm && data.collectionLat && data.collectionLng) {
      try {
        distanceKm = await calculateRoundTripDistance(
          data.collectionLat,
          data.collectionLng,
          config.warehouse.lat,
          config.warehouse.lng,
          config.routing?.openRouteServiceApiKey
        );
      } catch (error) {
        console.error('Error calculating road distance:', error);
        // Fallback to default distance if routing API fails
        distanceKm = 80;
      }
    }
    if (!distanceKm) {
      distanceKm = 80; // Default 80km round trip
    }

    // Convert categories to format expected by calculation
    const categoryData = categories.map(cat => ({
      id: cat.id,
      co2ePerUnit: cat.co2ePerUnit,
      avgWeight: cat.avgWeight,
      avgBuybackValue: cat.avgBuybackValue,
    }));

    // Calculate CO2e
    const result = calculateCO2e({
      assets: data.assets,
      distanceKm,
      vehicleType: data.vehicleType,
      categories: categoryData,
    });

    // Calculate buyback estimate
    const estimatedBuyback = calculateBuybackEstimate(data.assets, categoryData);

    return {
      ...result,
      estimatedBuyback,
    };
  }

  /**
   * Save CO2 calculation results for a job
   */
  async saveJobCO2Results(jobId: string, data: {
    reuseSavings: number;
    travelEmissions: number;
    netImpact: number;
    distanceKm: number;
    distanceMiles: number;
    vehicleEmissionsPetrol: number;
    vehicleEmissionsDiesel: number;
    vehicleEmissionsElectric: number;
    treesPlanted: number;
    householdDays: number;
    carMiles: number;
    flightHours: number;
    calculationType: 'pre_job' | 'post_job';
  }) {
    // Delete existing result if updating
    await prisma.cO2Result.deleteMany({
      where: { jobId },
    });

    return prisma.cO2Result.create({
      data: {
        jobId,
        ...data,
      },
    });
  }

  /**
   * Get CO2 results for a job
   */
  async getJobCO2Results(jobId: string) {
    return prisma.cO2Result.findUnique({
      where: { jobId },
    });
  }
}
