// Grading Service
import { NotFoundError, ValidationError } from '../utils/errors';
import prisma from '../config/database';
import { BookingRepository } from '../repositories/booking.repository';

const bookingRepo = new BookingRepository();

export interface GradingRecordData {
  id: string;
  bookingId: string;
  assetId: string;
  assetCategory: string;
  grade: 'A' | 'B' | 'C' | 'D' | 'Recycled';
  resaleValue: number;
  gradedAt: string;
  gradedBy: string;
  notes?: string;
  condition?: string;
}

const gradeConditionFactors: Record<string, number> = {
  'A': 1.05,     // 105% of Grade B baseline
  'B': 1.0,      // Baseline (100%)
  'C': 0.70,     // 70% of Grade B baseline
  'D': 0.25,     // 25% of Grade B baseline
  'Recycled': 0, // No resale value
};

const baseResaleValues: Record<string, number> = {
  'Laptop': 150,
  'Desktop': 80,
  'Server': 300,
  'Smart Phones': 30,
  'Tablets': 50,
  'Networking': 45,
  'Storage': 100,
};

export class GradingService {
  /**
   * Get grading records for a booking
   */
  async getGradingRecords(bookingId: string) {
    const booking = await bookingRepo.findById(bookingId);
    if (!booking) {
      throw new NotFoundError('Booking', bookingId);
    }

    // Get all job assets for this booking
    const job = await prisma.job.findUnique({
      where: { bookingId },
      include: {
        assets: {
          include: {
            category: true,
          },
        },
      },
    });

    if (!job) {
      return [];
    }

    // Filter assets that have been graded
    const gradedAssets = job.assets.filter(asset => asset.grade !== null);

    if (gradedAssets.length === 0) {
      return [];
    }

    // Transform job assets to grading records
    const records = gradedAssets.map(asset => ({
      id: asset.gradingRecordId || asset.id,
      bookingId,
      assetId: asset.categoryId,
      assetCategory: asset.categoryName,
      grade: asset.grade as 'A' | 'B' | 'C' | 'D' | 'Recycled',
      resaleValue: asset.resaleValue || 0,
      gradedAt: asset.updatedAt.toISOString(),
      gradedBy: '', // We don't track this in JobAsset currently
      notes: undefined,
      condition: undefined,
    }));


    return records;
  }

  /**
   * Create a grading record
   */
  async createGradingRecord(
    bookingId: string,
    assetId: string,
    assetCategory: string,
    grade: 'A' | 'B' | 'C' | 'D' | 'Recycled',
    gradedBy: string,
    condition?: string,
    notes?: string
  ) {
    const booking = await bookingRepo.findById(bookingId);
    if (!booking) {
      throw new NotFoundError('Booking', bookingId);
    }

    const job = await prisma.job.findUnique({
      where: { bookingId },
      include: {
        assets: {
          include: {
            category: true,
          },
        },
      },
    });

    if (!job) {
      throw new ValidationError('Job not found for this booking');
    }

    // Find the asset in the job
    const jobAsset = job.assets.find(asset => asset.categoryId === assetId);
    if (!jobAsset) {
      throw new NotFoundError('Asset', assetId);
    }

    if (jobAsset.grade) {
      throw new ValidationError('Asset has already been graded');
    }

    const { logger } = await import('../utils/logger');
    
    const config = await prisma.buybackConfig.findUnique({
      where: { id: 'singleton' },
    });
    
    const volumeFactor10 = config?.volumeFactor10 ?? 1.03;
    const volumeFactor50 = config?.volumeFactor50 ?? 1.06;
    const volumeFactor200 = config?.volumeFactor200 ?? 1.10;
    const ageFactor = config?.ageFactor ?? 1.0; // Fixed at 3 years
    const marketFactor = config?.marketFactor ?? 1.0;
    
    // Get volume factor based on quantity
    const getVolumeFactor = (quantity: number): number => {
      if (quantity >= 200) return volumeFactor200;
      if (quantity >= 50) return volumeFactor50;
      if (quantity >= 10) return volumeFactor10;
      return 1.00; // 1-9 items
    };
    
    // Get category from database
    const category = jobAsset.category || await prisma.assetCategory.findUnique({
      where: { id: jobAsset.categoryId },
    });
    
    if (!category) {
      throw new ValidationError(`Category not found for asset: ${assetId}`);
    }
    
    // Calculate base buyback using RRP × residualLow (same as buyback calculator)
    let baseBuyback: number;
    
    if (category.avgRRP != null && category.residualLow != null) {
      // Use new database fields (RRP × residual_low %)
      baseBuyback = category.avgRRP * category.residualLow;
    } else if (category.avgBuybackValue != null && category.avgBuybackValue > 0) {
      // Fallback to avgBuybackValue (already includes RRP × residual %)
      baseBuyback = category.avgBuybackValue;
    } else {
      // Last resort: use hardcoded fallback
      const categoryNameToMatch = (category.name || assetCategory).toLowerCase().trim();
      baseBuyback = baseResaleValues[categoryNameToMatch] || 0;
      
      if (baseBuyback === 0) {
        for (const [key, value] of Object.entries(baseResaleValues)) {
          if (categoryNameToMatch.includes(key.toLowerCase()) || key.toLowerCase().includes(categoryNameToMatch)) {
            baseBuyback = value;
            break;
          }
        }
      }
    }
    
    if (baseBuyback === 0) {
      logger.warn('No buyback values found for category', {
        categoryId: jobAsset.categoryId,
        categoryName: category.name,
      });
      baseBuyback = 0;
    }
    
    // Get grade-based condition factor
    const conditionFactor = gradeConditionFactors[grade] || 0;
    
    const volumeFactor = getVolumeFactor(jobAsset.quantity);
    const rawResaleValuePerUnit = baseBuyback * ageFactor * conditionFactor * volumeFactor * marketFactor;
    
    // Apply floor and cap from database
    const floor = category.buybackFloor ?? 0;
    const cap = category.buybackCap ?? Infinity;
    
    const resaleValuePerUnit = Math.max(floor, Math.min(cap, rawResaleValuePerUnit));
    const totalResaleValue = Math.round(resaleValuePerUnit * jobAsset.quantity * 100) / 100;
    
    // Log resale value calculation (debug level)
    logger.debug('Resale value calculation (buyback calculator logic)', {
      assetCategory,
      categoryName: category.name,
      categoryId: jobAsset.categoryId,
      baseBuyback,
      grade,
      conditionFactor,
      volumeFactor,
      ageFactor,
      marketFactor,
      resaleValuePerUnit,
      quantity: jobAsset.quantity,
      totalResaleValue,
    });

    // Generate grading record ID
    const gradingRecordId = `GRADE-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    // Update the job asset to mark it as graded
    await prisma.jobAsset.update({
      where: { id: jobAsset.id },
      data: {
        grade: grade,
        resaleValue: resaleValuePerUnit,
        gradingRecordId: gradingRecordId,
      },
    });

    return {
      id: gradingRecordId,
      bookingId,
      assetId,
      assetCategory,
      grade,
      resaleValue: resaleValuePerUnit,
      gradedAt: new Date().toISOString(),
      gradedBy,
      notes,
      condition,
    };
  }

  /**
   * Calculate resale value for a category and grade
   * Uses buyback calculator logic with grade-based condition factor
   */
  async calculateResaleValue(category: string, grade: 'A' | 'B' | 'C' | 'D' | 'Recycled', quantity: number): Promise<number> {
    // Get buyback config for factors
    const config = await prisma.buybackConfig.findUnique({
      where: { id: 'singleton' },
    });
    
    const volumeFactor10 = config?.volumeFactor10 ?? 1.03;
    const volumeFactor50 = config?.volumeFactor50 ?? 1.06;
    const volumeFactor200 = config?.volumeFactor200 ?? 1.10;
    const ageFactor = config?.ageFactor ?? 1.0; // Fixed at 3 years
    const marketFactor = config?.marketFactor ?? 1.0;
    
    // Get volume factor based on quantity
    const getVolumeFactor = (qty: number): number => {
      if (qty >= 200) return volumeFactor200;
      if (qty >= 50) return volumeFactor50;
      if (qty >= 10) return volumeFactor10;
      return 1.00; // 1-9 items
    };
    
    // Find category in database (case-insensitive)
    const categoryRecord = await prisma.assetCategory.findFirst({
      where: {
        name: {
          equals: category,
          mode: 'insensitive',
        },
      },
    });
    
    if (!categoryRecord) {
      const categoryLower = category.toLowerCase().trim();
      let baseBuyback = baseResaleValues[categoryLower] || 0;
      
      if (baseBuyback === 0) {
        for (const [key, value] of Object.entries(baseResaleValues)) {
          const keyLower = key.toLowerCase();
          if (categoryLower.includes(keyLower) || keyLower.includes(categoryLower)) {
            baseBuyback = value;
            break;
          }
        }
      }
      
      if (baseBuyback === 0) {
        return 0; // Category not found and no fallback
      }
      
      const conditionFactor = gradeConditionFactors[grade] || 0;
      const volumeFactor = getVolumeFactor(quantity);
      const resaleValuePerUnit = baseBuyback * ageFactor * conditionFactor * volumeFactor * marketFactor;
      return Math.round(resaleValuePerUnit * quantity * 100) / 100;
    }
    
    // Calculate base buyback using RRP × residualLow (same as buyback calculator)
    let baseBuyback: number;
    
    if (categoryRecord.avgRRP != null && categoryRecord.residualLow != null) {
      // Use new database fields (RRP × residual_low %)
      baseBuyback = categoryRecord.avgRRP * categoryRecord.residualLow;
    } else if (categoryRecord.avgBuybackValue != null && categoryRecord.avgBuybackValue > 0) {
      // Fallback to avgBuybackValue (already includes RRP × residual %)
      baseBuyback = categoryRecord.avgBuybackValue;
    } else {
      return 0; // No buyback values available
    }
    
    // Get grade-based condition factor
    const conditionFactor = gradeConditionFactors[grade] || 0;
    
    const volumeFactor = getVolumeFactor(quantity);
    const rawResaleValuePerUnit = baseBuyback * ageFactor * conditionFactor * volumeFactor * marketFactor;
    
    const floor = categoryRecord.buybackFloor ?? 0;
    const cap = categoryRecord.buybackCap ?? Infinity;
    
    const resaleValuePerUnit = Math.max(floor, Math.min(cap, rawResaleValuePerUnit));
    const totalResaleValue = Math.round(resaleValuePerUnit * quantity * 100) / 100;
    
    return totalResaleValue;
  }
}

