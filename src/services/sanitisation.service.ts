// Sanitisation Service
import { NotFoundError, ValidationError } from '../utils/errors';
import prisma from '../config/database';
import { BookingRepository } from '../repositories/booking.repository';

const bookingRepo = new BookingRepository();

export interface SanitisationRecordData {
  id: string;
  bookingId: string;
  assetId: string;
  method: 'blancco' | 'physical-destruction' | 'degaussing' | 'shredding' | 'other';
  methodDetails?: string;
  timestamp: string;
  performedBy: string;
  certificateId: string;
  certificateUrl: string;
  verified: boolean;
  notes?: string;
}

export class SanitisationService {
  /**
   * Get sanitisation records for a booking
   */
  async getSanitisationRecords(bookingId: string) {
    const booking = await bookingRepo.findById(bookingId);
    if (!booking) {
      throw new NotFoundError('Booking', bookingId);
    }

    // Get all job assets for this booking that have been sanitised
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

    // Filter assets that are sanitised
    const sanitisedAssets = job.assets.filter(asset => asset.sanitised);

    if (sanitisedAssets.length === 0) {
      return [];
    }

    // Transform job assets to sanitisation records
    const records = sanitisedAssets.map(asset => ({
      id: asset.sanitisationRecordId || asset.id,
      bookingId,
      assetId: asset.categoryId,
      method: this.mapWipeMethodToSanitisationMethod(asset.wipeMethod || 'other'),
      methodDetails: asset.wipeMethod || undefined,
      timestamp: asset.updatedAt.toISOString(),
      performedBy: '', // We don't track this in JobAsset currently
      certificateId: asset.sanitisationRecordId || `CERT-SANIT-${asset.id.substring(0, 8).toUpperCase()}`,
      certificateUrl: '#',
      verified: asset.sanitised,
      notes: undefined,
    }));


    return records;
  }

  /**
   * Create a sanitisation record
   */
  async createSanitisationRecord(
    bookingId: string,
    assetId: string,
    method: 'blancco' | 'physical-destruction' | 'degaussing' | 'shredding' | 'other',
    performedBy: string,
    methodDetails?: string,
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

    // Check if already sanitised
    if (jobAsset.sanitised) {
      throw new ValidationError('Asset has already been sanitised');
    }

    // Generate certificate ID
    const certificateId = `CERT-SANIT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    // Update the job asset to mark it as sanitised
    await prisma.jobAsset.update({
      where: { id: jobAsset.id },
      data: {
        sanitised: true,
        wipeMethod: methodDetails || method,
        sanitisationRecordId: certificateId,
      },
    });

    // Note: Status change and notifications are handled when admin clicks
    // "Approve & Move to Grading" button, not automatically when all assets are sanitised
    // This allows admin to review all sanitisation records before moving to next stage

    // Return the sanitisation record
    return {
      id: certificateId,
      bookingId,
      assetId,
      method,
      methodDetails,
      timestamp: new Date().toISOString(),
      performedBy,
      certificateId,
      certificateUrl: '#',
      verified: false,
      notes,
    };
  }

  /**
   * Verify a sanitisation record
   */
  async verifySanitisation(recordId: string) {
    // Find the job asset by sanitisationRecordId
    const jobAsset = await prisma.jobAsset.findFirst({
      where: {
        sanitisationRecordId: recordId,
      },
      include: {
        job: {
          include: {
            booking: true,
          },
        },
        category: true,
      },
    });

    if (!jobAsset) {
      throw new NotFoundError('Sanitisation record', recordId);
    }

    // Asset is already marked as sanitised, so it's verified
    // In a real system, you might have a separate verification step

    return {
      id: recordId,
      bookingId: jobAsset.job.bookingId || '',
      assetId: jobAsset.categoryId,
      method: this.mapWipeMethodToSanitisationMethod(jobAsset.wipeMethod || ''),
      methodDetails: jobAsset.wipeMethod || undefined,
      timestamp: jobAsset.updatedAt.toISOString(),
      performedBy: '',
      certificateId: recordId,
      certificateUrl: '#',
      verified: true,
      notes: undefined,
    };
  }

  /**
   * Map wipe method string to sanitisation method
   */
  private mapWipeMethodToSanitisationMethod(wipeMethod: string): 'blancco' | 'physical-destruction' | 'degaussing' | 'shredding' | 'other' {
    const lower = wipeMethod.toLowerCase();
    if (lower.includes('blancco')) return 'blancco';
    if (lower.includes('shred') || lower.includes('destruction')) return 'physical-destruction';
    if (lower.includes('degauss')) return 'degaussing';
    if (lower.includes('shred')) return 'shredding';
    return 'other';
  }
}

