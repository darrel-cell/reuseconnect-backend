// Grading Service
import { NotFoundError, ValidationError } from '../utils/errors';
import prisma from '../config/database';
import { BookingRepository } from '../repositories/booking.repository';
import { logger } from '../utils/logger';

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
  'A': 1.10,     // +10% above Grade B baseline
  'B': 1.0,      // Baseline (100% - buybackFloor)
  'C': 0.75,     // -25% below Grade B baseline
  'D': 0,        // Zero value
  'Recycled': 0, // No resale value
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

    // Transform job assets to grading records and recalculate resale value (matching new booking formula)
    const records = await Promise.all(gradedAssets.map(async (asset) => {
      const category = asset.category;
      if (!category) {
        return {
          id: asset.gradingRecordId || asset.id,
          bookingId,
          assetId: asset.categoryId,
          assetCategory: asset.categoryName,
          grade: asset.grade as 'A' | 'B' | 'C' | 'D' | 'Recycled',
          resaleValue: asset.resaleValue || 0, // Fallback to stored value
          gradedAt: asset.updatedAt.toISOString(),
          gradedBy: '', // We don't track this in JobAsset currently
          notes: undefined,
          condition: undefined,
        };
      }

      // Use buybackFloor directly (same as new booking calculation)
      const buybackFloor = category.buybackFloor ?? 0;
      
      if (buybackFloor === 0) {
        // Fallback to stored value if buybackFloor not set
        return {
          id: asset.gradingRecordId || asset.id,
          bookingId,
          assetId: asset.categoryId,
          assetCategory: asset.categoryName,
          grade: asset.grade as 'A' | 'B' | 'C' | 'D' | 'Recycled',
          resaleValue: asset.resaleValue || 0,
          gradedAt: asset.updatedAt.toISOString(),
          gradedBy: '',
          notes: undefined,
          condition: undefined,
        };
      }

      // Get grade-based condition factor
      const conditionFactor = gradeConditionFactors[asset.grade as keyof typeof gradeConditionFactors] || 0;
      
      // Simple calculation matching new booking: buybackFloor × conditionFactor
      const resaleValuePerUnit = buybackFloor * conditionFactor;

      return {
        id: asset.gradingRecordId || asset.id,
        bookingId,
        assetId: asset.categoryId,
        assetCategory: asset.categoryName,
        grade: asset.grade as 'A' | 'B' | 'C' | 'D' | 'Recycled',
        resaleValue: resaleValuePerUnit, // Recalculated per-unit value
        gradedAt: asset.updatedAt.toISOString(),
        gradedBy: '',
        notes: undefined,
        condition: undefined,
      };
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
    
    // Get category from database
    const category = jobAsset.category || await prisma.assetCategory.findUnique({
      where: { id: jobAsset.categoryId },
    });
    
    if (!category) {
      throw new ValidationError(`Category not found for asset: ${assetId}`);
    }
    
    // Use buybackFloor directly (same as new booking calculation)
    const buybackFloor = category.buybackFloor ?? 0;
    
    if (buybackFloor === 0) {
      logger.warn('No buybackFloor defined for category', {
        categoryId: jobAsset.categoryId,
        categoryName: category.name,
      });
    }
    
    // Get grade-based condition factor
    const conditionFactor = gradeConditionFactors[grade] || 0;
    
    // Simple calculation matching new booking: buybackFloor × conditionFactor
    const resaleValuePerUnit = buybackFloor * conditionFactor;
    const totalResaleValue = Math.round(resaleValuePerUnit * jobAsset.quantity * 100) / 100;
    
    // Log resale value calculation (debug level)
    logger.debug('Resale value calculation (matching new booking formula)', {
      assetCategory,
      categoryName: category.name,
      categoryId: jobAsset.categoryId,
      buybackFloor,
      grade,
      conditionFactor,
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
   * Uses the same simple formula as new booking calculation: buybackFloor × conditionFactor × quantity
   * 
   * Grade adjustments:
   * - Grade A: +10% (1.10 × buybackFloor)
   * - Grade B: baseline (1.0 × buybackFloor)
   * - Grade C: -25% (0.75 × buybackFloor)
   * - Grade D: zero (0 × buybackFloor)
   * - Recycled: zero (0 × buybackFloor)
   */
  async calculateResaleValue(category: string, grade: 'A' | 'B' | 'C' | 'D' | 'Recycled', quantity: number): Promise<number> {
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
      logger.warn(`Category not found for resale value calculation: ${category}`);
      return 0;
    }

    // Use buybackFloor directly (same as new booking calculation)
    const buybackFloor = categoryRecord.buybackFloor ?? 0;
    
    if (buybackFloor === 0) {
      logger.warn(`No buybackFloor defined for category: ${categoryRecord.name}`);
      return 0;
    }
    
    // Get grade-based condition factor
    const conditionFactor = gradeConditionFactors[grade] ?? 0;
    
    // Simple calculation matching new booking: buybackFloor × conditionFactor × quantity
    const resaleValuePerUnit = buybackFloor * conditionFactor;
    const totalResaleValue = Math.round(resaleValuePerUnit * quantity * 100) / 100;
    
    return totalResaleValue;
  }
}

