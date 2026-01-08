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

// Grade-based resale value multipliers (per unit)
const gradeMultipliers: Record<string, number> = {
  'A': 1.0,      // Full value
  'B': 0.7,      // 70% value
  'C': 0.4,      // 40% value
  'D': 0.2,      // 20% value
  'Recycled': 0, // No resale value
};

// Base resale values by category (per unit) - FALLBACK ONLY
// Primary source should be database avgBuybackValue
// These must match the exact category names in the database (case-sensitive matching)
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

    // Find the job for this booking
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

    // Check if already graded
    if (jobAsset.grade) {
      throw new ValidationError('Asset has already been graded');
    }

    // Calculate resale value based on grade and category
    // PRIORITY: Use database avgBuybackValue first (most reliable)
    let baseValue = 0;
    
    // Log category info (debug level)
    const { logger } = await import('../utils/logger');
    logger.debug('Grading category info', {
      assetCategory,
      jobAssetCategoryName: jobAsset.categoryName,
      categoryId: jobAsset.categoryId,
      hasCategory: !!jobAsset.category,
      categoryName: jobAsset.category?.name,
      avgBuybackValue: jobAsset.category?.avgBuybackValue,
    });
    
    // First, try to use the category's avgBuybackValue from the database
    // This is the PRIMARY source - database values are most reliable
    if (jobAsset.category && jobAsset.category.avgBuybackValue != null && jobAsset.category.avgBuybackValue > 0) {
      baseValue = jobAsset.category.avgBuybackValue;
      logger.debug('Using avgBuybackValue from database', {
        categoryName: jobAsset.category.name,
        avgBuybackValue: baseValue,
      });
    } else if (jobAsset.category) {
      // Category exists but avgBuybackValue is 0 or null - try to fetch it directly
      const category = await prisma.assetCategory.findUnique({
        where: { id: jobAsset.categoryId },
        select: { avgBuybackValue: true, name: true },
      });
      
      if (category && category.avgBuybackValue && category.avgBuybackValue > 0) {
        baseValue = category.avgBuybackValue;
        logger.debug('Fetched avgBuybackValue directly from database', {
          categoryName: category.name,
          avgBuybackValue: baseValue,
        });
      }
    }
    
    // If database value is still not available, try to match category name to hardcoded values
    if (baseValue === 0) {
      // Use the category name from the job asset (more reliable than the parameter)
      const categoryNameToMatch = (jobAsset.categoryName || jobAsset.category?.name || assetCategory).toLowerCase().trim();
      
      
      // First, try exact match (case-insensitive)
      for (const [key, value] of Object.entries(baseResaleValues)) {
        if (categoryNameToMatch === key.toLowerCase()) {
          baseValue = value;
          break;
        }
      }
      
      // If no exact match, try partial matching (e.g., "Laptop" matches "laptop")
      if (baseValue === 0) {
        for (const [key, value] of Object.entries(baseResaleValues)) {
          const keyLower = key.toLowerCase();
          // Check if category name contains the key or vice versa
          if (categoryNameToMatch.includes(keyLower) || keyLower.includes(categoryNameToMatch)) {
            baseValue = value;
            break;
          }
        }
      }
      
      // If still no match, try word-by-word matching (e.g., "Laptop Computer" matches "laptop")
      if (baseValue === 0) {
        const categoryWords = categoryNameToMatch.split(/\s+/);
        for (const [key, value] of Object.entries(baseResaleValues)) {
          const keyLower = key.toLowerCase();
          if (categoryWords.some(word => word === keyLower || word.includes(keyLower) || keyLower.includes(word))) {
            baseValue = value;
            break;
          }
        }
      }
    }
    
    // If still no match, default to 0 (will result in 0 resale value)
    
    const multiplier = gradeMultipliers[grade] || 0;
    const resaleValuePerUnit = Math.round(baseValue * multiplier);
    const totalResaleValue = resaleValuePerUnit * jobAsset.quantity;
    
    // Log resale value calculation (debug level)
    const categoryNameToMatchForLog = (jobAsset.categoryName || jobAsset.category?.name || assetCategory).toLowerCase().trim();
    logger.debug('Resale value calculation', {
      assetCategory,
      categoryNameToMatch: categoryNameToMatchForLog,
      jobAssetCategoryName: jobAsset.categoryName,
      categoryName: jobAsset.category?.name,
      baseValue,
      grade,
      multiplier,
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

    // Note: Status change and notifications are handled when admin clicks
    // "Approve & Move to Graded" button, not automatically when all assets are graded
    // This allows admin to review all grading records before moving to next stage

    // Return the grading record
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
   * This method queries the database to get the actual avgBuybackValue from the category
   */
  async calculateResaleValue(category: string, grade: 'A' | 'B' | 'C' | 'D' | 'Recycled', quantity: number): Promise<number> {
    let baseValue = 0;
    
    // First, try to find the category in the database by name (case-insensitive)
    const categoryRecord = await prisma.assetCategory.findFirst({
      where: {
        name: {
          equals: category,
          mode: 'insensitive',
        },
      },
      select: {
        avgBuybackValue: true,
        name: true,
      },
    });
    
    if (categoryRecord && categoryRecord.avgBuybackValue && categoryRecord.avgBuybackValue > 0) {
      baseValue = categoryRecord.avgBuybackValue;
    } else {
      // Fallback to hardcoded values if category not found in database
      const categoryLower = category.toLowerCase().trim();
      
      // Try exact match first
      baseValue = baseResaleValues[categoryLower] || 0;
      
      // If no exact match, try partial matching
      if (baseValue === 0) {
        for (const [key, value] of Object.entries(baseResaleValues)) {
          const keyLower = key.toLowerCase();
          if (categoryLower.includes(keyLower) || keyLower.includes(categoryLower)) {
            baseValue = value;
            break;
          }
        }
      }
      
      // Try word-by-word matching
      if (baseValue === 0) {
        const categoryWords = categoryLower.split(/\s+/);
        for (const [key, value] of Object.entries(baseResaleValues)) {
          const keyLower = key.toLowerCase();
          if (categoryWords.some(word => word === keyLower || word.includes(keyLower) || keyLower.includes(word))) {
            baseValue = value;
            break;
          }
        }
      }
      
    }
    
    const multiplier = gradeMultipliers[grade] || 0;
    const resaleValuePerUnit = Math.round(baseValue * multiplier);
    const totalResaleValue = resaleValuePerUnit * quantity;
    
    
    return totalResaleValue;
  }
}

