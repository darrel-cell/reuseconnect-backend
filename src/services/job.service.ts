// Job Service

import { JobRepository } from '../repositories/job.repository';
import { BookingRepository } from '../repositories/booking.repository';
import { isValidJobTransition, isValidBookingTransition } from '../middleware/workflow';
import { ValidationError, NotFoundError } from '../utils/errors';
import { JobStatus, BookingStatus } from '../types';
import { calculateTravelEmissions } from '../utils/co2';
import prisma from '../config/database';

const jobRepo = new JobRepository();
const bookingRepo = new BookingRepository();

export class JobService {
  /**
   * Create job from booking (when driver assigned)
   * If job already exists (created when booking was approved), update it to 'routed' and assign driver
   */
  async createJobFromBooking(bookingId: string, driverId: string) {
    const booking = await bookingRepo.findById(bookingId);
    if (!booking) {
      throw new NotFoundError('Booking', bookingId);
    }

    if (!booking.erpJobNumber) {
      throw new ValidationError('Booking must have ERP job number before creating job');
    }

    // Get driver info with profile
    const driver = await prisma.user.findUnique({
      where: { id: driverId },
      include: { driverProfile: true },
    });

    if (!driver || driver.role !== 'driver') {
      throw new NotFoundError('Driver', driverId);
    }

    // Recalculate travel emissions based on driver's vehicle fuel type and vehicle type
    // Priority: driver's vehicleFuelType > booking's preferredVehicleType > default 'van'
    // Use booking's roundTripDistanceKm (distance from collection site to warehouse)
    const vehicleFuelType = driver.driverProfile?.vehicleFuelType || booking.preferredVehicleType || 'van';
    const roundTripDistanceKm = booking.roundTripDistanceKm || 80; // Fallback to 80km if not set
    const travelEmissions = calculateTravelEmissions(roundTripDistanceKm, vehicleFuelType);

    // Check if job already exists (created when booking was approved)
    let job = await jobRepo.findByBookingId(booking.id);

    if (job) {
      // Job already exists - update it to 'routed', assign driver, and update travel emissions
      if (isValidJobTransition(job.status, 'routed')) {
        await jobRepo.update(job.id, {
          status: 'routed',
          driverId: driverId,
          travelEmissions: travelEmissions, // Update travel emissions when driver is assigned
        });

        await jobRepo.addStatusHistory(job.id, {
          status: 'routed',
          changedBy: driverId,
          notes: 'Driver assigned - job moved to routed status',
        });
      } else {
        // If transition is not valid, just assign the driver and update travel emissions
        await jobRepo.update(job.id, {
          driverId: driverId,
          travelEmissions: travelEmissions, // Update travel emissions when driver is assigned
        });
      }
    } else {
      // Create new job with status 'routed'
      job = await jobRepo.create({
        erpJobNumber: booking.erpJobNumber!,
        bookingId: booking.id,
        tenantId: booking.tenantId,
        clientName: booking.client.name,
        siteName: booking.siteName,
        siteAddress: booking.siteAddress,
        status: 'routed', // Job starts as 'routed' when driver assigned
        scheduledDate: booking.scheduledDate,
        co2eSaved: booking.estimatedCO2e,
        travelEmissions: travelEmissions, // Calculate from booking's round trip distance and driver's vehicle type
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
    }

    // Notify driver of job status change (routed) - this replaces notifyJobAssignment to avoid duplicates
    const { notifyJobStatusChange } = await import('../utils/notifications');
    await notifyJobStatusChange(
      job.id,
      job.erpJobNumber,
      'routed',
      driverId,
      booking.tenantId,
      'driver'
    );

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
      // Admins should see all jobs across all tenants (no tenantId filter)
      const where: any = {};
      if (filters.status) {
        where.status = filters.status;
      }
      if (filters.clientName) {
        where.clientName = {
          contains: filters.clientName,
          mode: 'insensitive',
        };
      }
      if (filters.searchQuery) {
        where.OR = [
          { clientName: { contains: filters.searchQuery, mode: 'insensitive' } },
          { erpJobNumber: { contains: filters.searchQuery, mode: 'insensitive' } },
          { siteName: { contains: filters.searchQuery, mode: 'insensitive' } },
          { siteAddress: { contains: filters.searchQuery, mode: 'insensitive' } },
        ];
      }

      return prisma.job.findMany({
        where,
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
      // Exclude pending bookings - they should not appear in jobs list
      const bookings = await prisma.booking.findMany({
        where: {
          tenantId: filters.tenantId,
          status: { not: 'pending' }, // Exclude pending bookings
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

    // Notify driver of job status change (if driver is assigned and status is relevant)
    // According to requirements: Driver notified for warehouse only (NOT completed)
    if (job.driverId && newStatus === 'warehouse') {
      const { notifyJobStatusChange } = await import('../utils/notifications');
      await notifyJobStatusChange(
        job.id,
        job.erpJobNumber,
        newStatus,
        job.driverId,
        job.tenantId,
        'driver'
      );
    }

    // Notify client/reseller of booking status change when job status changes
    // Notify for all status changes that affect the client (and reseller, for important events)
        if (job.bookingId) {
      const booking = await bookingRepo.findById(job.bookingId);
      if (booking) {
        const { 
          notifyBookingStatusChange, 
          notifyDriverEnRoute, 
          notifyDriverArrived 
        } = await import('../utils/notifications');

        // Derive reseller userId from either booking.resellerId or the linked client.resellerId
        const resellerUserId = booking.resellerId || booking.client?.resellerId;

        // Resolve the actual client user (invited client) if one exists, based on the Client record's email.
        const clientUser = booking.client?.email
          ? await prisma.user.findFirst({
              where: {
                tenantId: booking.tenantId,
                email: booking.client.email,
                role: 'client',
              },
            })
          : null;
        const clientUserId = clientUser?.id || booking.createdBy;
        
        // Map job status to booking status and notify client
        if (newStatus === 'en_route' || newStatus === 'en-route') {
          // Notify client that driver is en route (special notification)
          await notifyDriverEnRoute(
            booking.id,
            booking.bookingNumber,
            clientUserId,
            booking.tenantId
          );
        } else if (newStatus === 'arrived') {
          // Notify client that driver has arrived (special notification)
          await notifyDriverArrived(
            booking.id,
            booking.bookingNumber,
            clientUserId,
            booking.tenantId
          );
        } else if (['collected', 'warehouse', 'sanitised', 'graded', 'completed'].includes(newStatus)) {
          // Handle different statuses with appropriate notifications
          if (newStatus === 'collected') {
            // Map job status 'collected' to booking status 'collected'
            // Only notify if booking status is different to prevent duplicate "Booking collected" notifications
            if (booking.status !== 'collected') {
              await notifyBookingStatusChange(
                booking.id,
                booking.bookingNumber,
                'collected',
                booking.createdBy,
                booking.tenantId
              );
              // Reseller does NOT receive 'collected' per requirements
            }
          } else if (newStatus === 'warehouse') {
            // For warehouse status, send a special notification about assets being delivered
            const { notifyAssetsDeliveredToWarehouse } = await import('../utils/notifications');
            // Notify client
            await notifyAssetsDeliveredToWarehouse(
              booking.id,
              booking.bookingNumber,
              clientUserId,
              booking.tenantId
            );
            // Notify reseller (important milestone) if linked and different from creator
            if (resellerUserId && resellerUserId !== clientUserId) {
              await notifyAssetsDeliveredToWarehouse(
                booking.id,
                booking.bookingNumber,
                resellerUserId,
                booking.tenantId
              );
            }
          } else {
            // For sanitised, graded, completed - map job status to booking status
            const bookingStatus = newStatus;
            // Always notify for these milestones (even if booking status hasn't changed yet)
            await notifyBookingStatusChange(
              booking.id,
              booking.bookingNumber,
              bookingStatus,
              clientUserId,
              booking.tenantId
            );

            // Additionally notify reseller for important milestones
            // Reseller important: graded, completed
            if (
              resellerUserId &&
              resellerUserId !== clientUserId &&
              (newStatus === 'graded' || newStatus === 'completed')
            ) {
              await notifyBookingStatusChange(
                booking.id,
                booking.bookingNumber,
                bookingStatus,
                resellerUserId,
                booking.tenantId
              );
            }
          }
        }
      }
    }

    // Notify admins of job status changes for warehouse, sanitised, completed
    // Note: 'graded' status notification is handled by notifyGradedForApproval in booking.service.ts
    // to avoid duplicate notifications and provide more specific messaging
    if (['warehouse', 'sanitised', 'completed'].includes(newStatus)) {
      const adminUsers = await prisma.user.findMany({
        where: {
          tenantId: job.tenantId,
          role: 'admin',
          status: 'active',
        },
        select: { id: true },
      });
      
      if (adminUsers.length > 0) {
        const { notifyJobStatusChange } = await import('../utils/notifications');
        // Notify each admin
        for (const admin of adminUsers) {
          await notifyJobStatusChange(
            job.id,
            job.erpJobNumber,
            newStatus,
            admin.id,
            job.tenantId,
            'admin'
          );
        }
      }
    }

    // Sync booking status when job status changes
    if (job.bookingId) {
      const booking = await bookingRepo.findById(job.bookingId);
      if (booking) {
        // Map job status to booking status
        let targetBookingStatus: BookingStatus | null = null;

        // Map job statuses to booking statuses
        if (newStatus === 'collected' || newStatus === 'warehouse') {
          // Both "collected" and "warehouse" mean booking is "collected"
          targetBookingStatus = 'collected';
        } else if (newStatus === 'sanitised') {
          targetBookingStatus = 'sanitised';
        } else if (newStatus === 'graded') {
          targetBookingStatus = 'graded';
        } else if (newStatus === 'completed') {
          targetBookingStatus = 'completed';
        } else if (newStatus === 'cancelled') {
          targetBookingStatus = 'cancelled';
        }

        // Update booking status if it's different and the transition is valid
        if (targetBookingStatus && booking.status !== targetBookingStatus) {
          if (isValidBookingTransition(booking.status, targetBookingStatus)) {
            const updateData: any = { status: targetBookingStatus };
            
            // Set appropriate timestamps
            if (targetBookingStatus === 'collected' && !booking.collectedAt) {
              updateData.collectedAt = new Date();
            } else if (targetBookingStatus === 'sanitised' && !booking.sanitisedAt) {
              updateData.sanitisedAt = new Date();
            } else if (targetBookingStatus === 'graded' && !booking.gradedAt) {
              updateData.gradedAt = new Date();
            } else if (targetBookingStatus === 'completed' && !booking.completedAt) {
              updateData.completedAt = new Date();
            }

            await bookingRepo.update(booking.id, updateData);
            await bookingRepo.addStatusHistory(booking.id, {
              status: targetBookingStatus,
              changedBy,
              notes: `Updated from job status: ${newStatus}`,
            });
          }
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
