// Job Service

import { JobRepository } from '../repositories/job.repository';
import { BookingRepository } from '../repositories/booking.repository';
import { isValidJobTransition } from '../middleware/workflow';
import { ValidationError, NotFoundError } from '../utils/errors';
import { JobStatus } from '../types';
import prisma from '../config/database';

const jobRepo = new JobRepository();
const bookingRepo = new BookingRepository();

export class JobService {
  /**
   * Create job from booking (when driver assigned)
   */
  async createJobFromBooking(bookingId: string, driverId: string) {
    const booking = await bookingRepo.findById(bookingId);
    if (!booking) {
      throw new NotFoundError('Booking', bookingId);
    }

    if (!booking.erpJobNumber) {
      throw new ValidationError('Booking must have ERP job number before creating job');
    }

    // Get driver info
    const driver = await prisma.user.findUnique({
      where: { id: driverId },
    });

    if (!driver || driver.role !== 'driver') {
      throw new NotFoundError('Driver', driverId);
    }

    // Create job
    const job = await jobRepo.create({
      erpJobNumber: booking.erpJobNumber!,
      bookingId: booking.id,
      tenantId: booking.tenantId,
      clientName: booking.client.name,
      siteName: booking.siteName,
      siteAddress: booking.siteAddress,
      status: 'routed', // Job starts as 'routed' when driver assigned
      scheduledDate: booking.scheduledDate,
      co2eSaved: booking.estimatedCO2e,
      travelEmissions: 0, // Will be calculated when driver completes
      buybackValue: booking.estimatedBuyback,
      charityPercent: booking.charityPercent,
      driverId: driverId,
    });

    // Create job assets from booking assets
    for (const bookingAsset of booking.assets) {
      await prisma.jobAsset.create({
        data: {
          jobId: job.id,
          categoryId: bookingAsset.categoryId,
          categoryName: bookingAsset.categoryName,
          quantity: bookingAsset.quantity,
        },
      });
    }

    // Add status history
    await jobRepo.addStatusHistory(job.id, {
      status: 'routed',
      changedBy: driverId,
      notes: 'Job created from booking',
    });

    // Link job to booking
    await bookingRepo.update(booking.id, {
      jobId: job.id,
    });

    return this.getJobById(job.id);
  }

  /**
   * Get job by ID
   */
  async getJobById(id: string) {
    const job = await jobRepo.findById(id);
    if (!job) {
      throw new NotFoundError('Job', id);
    }
    return job;
  }

  /**
   * Get jobs with filters
   */
  async getJobs(filters: {
    tenantId: string;
    userId: string;
    userRole: string;
    status?: JobStatus;
    clientName?: string;
    searchQuery?: string;
    limit?: number;
    offset?: number;
  }) {
    // Role-based filtering
    if (filters.userRole === 'admin') {
      return jobRepo.findByTenant(filters.tenantId, {
        status: filters.status,
        clientName: filters.clientName,
        searchQuery: filters.searchQuery,
        limit: filters.limit,
        offset: filters.offset,
      });
    } else if (filters.userRole === 'driver') {
      // Drivers can see all their jobs (for history)
      // Access restriction to jobs at "warehouse" or beyond is handled at the UI level (DriverJobView)
      return jobRepo.findByDriver(filters.userId, {
        status: filters.status,
        limit: filters.limit,
        offset: filters.offset,
      });
    } else if (filters.userRole === 'client') {
      // Clients see jobs for their bookings (bookings for their Client record(s) or bookings they created)
      // First, find the Client record(s) associated with this user (by email and tenantId)
      const user = await prisma.user.findUnique({
        where: { id: filters.userId },
        select: { email: true },
      });
      
      if (!user) {
        return [];
      }
      
      // Find all Client records with matching email and tenantId
      const clientRecords = await prisma.client.findMany({
        where: {
          email: user.email,
          tenantId: filters.tenantId,
        },
        select: { id: true },
      });
      
      const clientIds = clientRecords.map(c => c.id);
      
      // Get bookings for these Client records OR bookings they created themselves
      const bookings = await prisma.booking.findMany({
        where: {
          tenantId: filters.tenantId,
          OR: [
            { clientId: { in: clientIds } },
            { createdBy: filters.userId },
          ],
        },
        select: { id: true },
      });
      
      const bookingIds = bookings.map(b => b.id);
      
      if (bookingIds.length === 0) {
        return [];
      }
      
      return prisma.job.findMany({
        where: {
          tenantId: filters.tenantId,
          bookingId: { in: bookingIds },
          ...(filters.status ? { status: filters.status } : {}),
        },
        include: {
          booking: {
            include: { client: true },
          },
          assets: {
            include: { category: true },
          },
          driver: {
            include: {
              driverProfile: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: filters.limit,
        skip: filters.offset,
      });
    } else if (filters.userRole === 'reseller') {
      // Resellers see jobs for their clients' bookings
      const bookings = await bookingRepo.findByReseller(filters.userId);
      const bookingIds = bookings.map(b => b.id);
      
      return prisma.job.findMany({
        where: {
          tenantId: filters.tenantId,
          bookingId: { in: bookingIds },
          status: filters.status,
        },
        include: {
          booking: {
            include: { client: true },
          },
          assets: {
            include: { category: true },
          },
          driver: {
            include: {
              driverProfile: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: filters.limit,
        skip: filters.offset,
      });
    }

    return [];
  }

  /**
   * Update job status
   */
  async updateStatus(
    jobId: string,
    newStatus: JobStatus,
    changedBy: string,
    notes?: string
  ) {
    const job = await this.getJobById(jobId);

    if (!isValidJobTransition(job.status, newStatus)) {
      throw new ValidationError(
        `Invalid status transition from "${job.status}" to "${newStatus}"`
      );
    }

    // Update job
    const updateData: any = { status: newStatus };
    if (newStatus === 'completed' && !job.completedDate) {
      updateData.completedDate = new Date();
    }

    await jobRepo.update(job.id, updateData);

    // Add status history
    await jobRepo.addStatusHistory(job.id, {
      status: newStatus,
      changedBy,
      notes,
    });

    // Sync booking status when job status changes
    if (job.bookingId) {
      const booking = await bookingRepo.findById(job.bookingId);
      if (booking) {
        if (newStatus === 'collected' && booking.status === 'scheduled') {
          await bookingRepo.update(booking.id, {
            status: 'collected',
            collectedAt: new Date(),
          });
          await bookingRepo.addStatusHistory(booking.id, {
            status: 'collected',
            changedBy,
            notes: 'Updated from job status',
          });
        } else if (newStatus === 'sanitised' && booking.status === 'collected') {
          await bookingRepo.update(booking.id, {
            status: 'sanitised',
            sanitisedAt: new Date(),
          });
          await bookingRepo.addStatusHistory(booking.id, {
            status: 'sanitised',
            changedBy,
            notes: 'Updated from job status',
          });
        } else if (newStatus === 'graded' && booking.status === 'sanitised') {
          await bookingRepo.update(booking.id, {
            status: 'graded',
            gradedAt: new Date(),
          });
          await bookingRepo.addStatusHistory(booking.id, {
            status: 'graded',
            changedBy,
            notes: 'Updated from job status',
          });
        } else if (newStatus === 'completed' && booking.status === 'graded') {
          await bookingRepo.update(booking.id, {
            status: 'completed',
            completedAt: new Date(),
          });
          await bookingRepo.addStatusHistory(booking.id, {
            status: 'completed',
            changedBy,
            notes: 'Updated from job status',
          });
        }
      }
    }

    return this.getJobById(job.id);
  }

  /**
   * Update job evidence (driver uploads)
   * Evidence is immutable once submitted - can only be created, not updated
   * Each status requires separate evidence submission
   */
  async updateEvidence(jobId: string, data: {
    photos?: string[];
    signature?: string;
    sealNumbers?: string[];
    notes?: string;
    status: JobStatus; // Status for which evidence is being submitted
    uploadedBy: string;
  }) {
    const job = await this.getJobById(jobId);

    // Check if evidence already exists for this status
    // Using findFirst until Prisma Client is regenerated with the new unique constraint
    const existingEvidence = await prisma.evidence.findFirst({
      where: { 
        jobId: job.id,
        status: data.status,
      },
    });

    if (existingEvidence) {
      // Evidence is immutable - cannot be updated once submitted
      throw new ValidationError(`Evidence has already been submitted for status "${data.status}" and cannot be modified. Evidence is immutable for audit purposes.`);
    }

    // Debug: Log evidence data before saving
    console.log('[Evidence Service] Saving evidence:', {
      jobId: job.id,
      status: data.status,
      photosCount: Array.isArray(data.photos) ? data.photos.length : 0,
      photos: data.photos,
      hasSignature: !!data.signature,
      signature: data.signature ? 'present' : 'missing',
      sealNumbersCount: Array.isArray(data.sealNumbers) ? data.sealNumbers.length : 0,
      sealNumbers: data.sealNumbers,
      hasNotes: !!data.notes,
      notes: data.notes,
      uploadedBy: data.uploadedBy,
    });

    // Validate that evidence data exists - prevent empty evidence records
    const photos = Array.isArray(data.photos) ? data.photos.filter((p: any) => p && typeof p === 'string' && p.trim().length > 0) : [];
    const signature = (data.signature && typeof data.signature === 'string' && data.signature.trim().length > 0) ? data.signature : null;
    const sealNumbers = Array.isArray(data.sealNumbers) ? data.sealNumbers.filter((s: any) => s && typeof s === 'string' && s.trim().length > 0) : [];
    const notes = (data.notes && typeof data.notes === 'string' && data.notes.trim().length > 0) ? data.notes : null;

    // Require at least one photo OR a signature to create evidence record
    if (photos.length === 0 && !signature) {
      throw new ValidationError('Evidence must include at least one photo or a customer signature. Cannot create empty evidence records.');
    }

    // Create new evidence for this status (using cleaned/validated data)
    const createdEvidence = await prisma.evidence.create({
      data: {
        jobId: job.id,
        status: data.status,
        uploadedBy: data.uploadedBy,
        photos: photos,
        signature: signature,
        sealNumbers: sealNumbers,
        notes: notes,
      },
    });

    // Debug: Log created evidence
    console.log('[Evidence Service] Evidence created:', {
      id: createdEvidence.id,
      jobId: createdEvidence.jobId,
      status: createdEvidence.status,
      photosCount: createdEvidence.photos.length,
      hasSignature: !!createdEvidence.signature,
      sealNumbersCount: createdEvidence.sealNumbers.length,
      hasNotes: !!createdEvidence.notes,
    });

    return this.getJobById(job.id);
  }
}
