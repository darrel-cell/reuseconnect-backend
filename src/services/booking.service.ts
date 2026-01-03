// Booking Service

import { BookingRepository } from '../repositories/booking.repository';
import { CO2Service } from './co2.service';
import { mockERPService } from './mock-erp.service';
import { isValidBookingTransition } from '../middleware/workflow';
import { ValidationError, NotFoundError, ForbiddenError } from '../utils/errors';
import { BookingStatus } from '../types';
import { config } from '../config/env';
import prisma from '../config/database';

const bookingRepo = new BookingRepository();
const co2Service = new CO2Service();

export class BookingService {
  /**
   * Create a new booking
   */
  async createBooking(data: {
    clientId: string;
    clientName: string;
    tenantId: string;
    siteId?: string;
    siteName: string;
    address: string;
    postcode: string;
    lat?: number;
    lng?: number;
    scheduledDate: Date;
    assets: Array<{ categoryId: string; quantity: number }>;
    charityPercent?: number;
    preferredVehicleType?: string;
    resellerId?: string;
    resellerName?: string;
    createdBy: string;
  }) {
    // Calculate CO2e and buyback estimate
    const co2Result = await co2Service.calculateBookingCO2e({
      assets: data.assets,
      collectionLat: data.lat,
      collectionLng: data.lng,
      vehicleType: data.preferredVehicleType as any,
      tenantId: data.tenantId,
    });

    // Ensure Client record exists (for foreign key constraint)
    // If clientId is provided, verify it exists and belongs to the tenant
    // Otherwise, find or create client for tenantId
    let actualClientId: string;
    
    if (data.clientId) {
      // Verify client exists and belongs to the tenant
      const existingClient = await prisma.client.findFirst({
        where: { 
          id: data.clientId,
          tenantId: data.tenantId, // Ensure it belongs to the same tenant
        },
      });
      
      if (existingClient) {
        // If resellerId is provided and client doesn't have one, update it
        // If client already has a different resellerId, that's handled by the controller
        if (data.resellerId && !existingClient.resellerId) {
          await prisma.client.update({
            where: { id: existingClient.id },
            data: {
              resellerId: data.resellerId,
              resellerName: data.resellerName,
            },
          });
        }
        actualClientId = existingClient.id;
      } else {
        // Client doesn't exist or doesn't belong to tenant, create new one
        const newClient = await prisma.client.create({
          data: {
            tenantId: data.tenantId,
            name: data.clientName || 'Client',
            status: 'active',
            resellerId: data.resellerId,
            resellerName: data.resellerName,
          },
        });
        actualClientId = newClient.id;
      }
    } else {
      // No clientId provided, find or create client for tenantId
      let client = await prisma.client.findFirst({
        where: { tenantId: data.tenantId },
      });
      
      if (!client) {
        // Create client for this tenant
        client = await prisma.client.create({
          data: {
            tenantId: data.tenantId,
            name: data.clientName || 'Client',
            status: 'active',
            resellerId: data.resellerId,
            resellerName: data.resellerName,
          },
        });
      } else if (data.resellerId && !client.resellerId) {
        // If resellerId is provided and client doesn't have one, update it
        client = await prisma.client.update({
          where: { id: client.id },
          data: {
            resellerId: data.resellerId,
            resellerName: data.resellerName,
          },
        });
      }
      
      actualClientId = client.id;
    }

    // Generate booking number
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 10000);
    const bookingNumber = `BK-${year}-${String(random).padStart(5, '0')}`;

    // Create booking
    const booking = await bookingRepo.create({
      bookingNumber,
      clientId: actualClientId,
      tenantId: data.tenantId,
      siteId: data.siteId,
      siteName: data.siteName,
      siteAddress: data.address,
      postcode: data.postcode,
      lat: data.lat,
      lng: data.lng,
      scheduledDate: data.scheduledDate,
      status: 'created',
      charityPercent: data.charityPercent || 0,
      estimatedCO2e: co2Result.reuseSavings,
      estimatedBuyback: co2Result.estimatedBuyback,
      preferredVehicleType: data.preferredVehicleType,
      roundTripDistanceKm: co2Result.distanceKm,
      roundTripDistanceMiles: co2Result.distanceMiles,
      resellerId: data.resellerId,
      resellerName: data.resellerName,
      createdBy: data.createdBy,
    });

    // Create booking assets
    for (const asset of data.assets) {
      const category = await prisma.assetCategory.findUnique({
        where: { id: asset.categoryId },
      });

      await prisma.bookingAsset.create({
        data: {
          bookingId: booking.id,
          categoryId: asset.categoryId,
          categoryName: category?.name || asset.categoryId,
          quantity: asset.quantity,
        },
      });
    }

    // Add status history
    await bookingRepo.addStatusHistory(booking.id, {
      status: 'created',
      changedBy: data.createdBy,
    });

    // Call Mock ERP to get job number
    if (config.erp.mockEnabled) {
      try {
        const erpResponse = await mockERPService.createJob({
          clientName: data.clientName,
          siteName: data.siteName,
          siteAddress: data.address,
          scheduledDate: data.scheduledDate.toISOString(),
          assets: data.assets.map(a => ({
            categoryName: a.categoryId, // Will be replaced with actual name
            quantity: a.quantity,
          })),
        });

        await bookingRepo.update(booking.id, {
          erpJobNumber: erpResponse.jobNumber,
        });
      } catch (error) {
        console.error('Failed to create ERP job:', error);
        // Continue without ERP job number
      }
    }

    return this.getBookingById(booking.id);
  }

  /**
   * Get booking by ID
   */
  async getBookingById(id: string) {
    const booking = await bookingRepo.findById(id);
    if (!booking) {
      throw new NotFoundError('Booking', id);
    }
    return booking;
  }

  /**
   * Get bookings with filters
   */
  async getBookings(filters: {
    tenantId: string;
    userId: string;
    userRole: string;
    clientId?: string;
    resellerId?: string;
    status?: BookingStatus;
    limit?: number;
    offset?: number;
  }) {
    // Role-based filtering
    if (filters.userRole === 'admin') {
      return bookingRepo.findByTenant(filters.tenantId, {
        status: filters.status,
        clientId: filters.clientId,
        limit: filters.limit,
        offset: filters.offset,
      });
    } else if (filters.userRole === 'client') {
      // Clients see bookings for their Client record(s)
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
      
      if (clientRecords.length === 0) {
        return [];
      }
      
      const clientIds = clientRecords.map(c => c.id);
      
      // Get bookings for these Client records
      // Also include bookings they created themselves (for backward compatibility)
      const bookings = await prisma.booking.findMany({
        where: {
          tenantId: filters.tenantId,
          OR: [
            { clientId: { in: clientIds } },
            { createdBy: filters.userId },
          ],
          ...(filters.status ? { status: filters.status } : {}),
        },
        include: {
          client: true,
          site: true,
          assets: {
            include: { category: true },
          },
          job: true,
        },
        orderBy: { createdAt: 'desc' },
        take: filters.limit,
        skip: filters.offset,
      });
      
      return bookings;
    } else if (filters.userRole === 'reseller') {
      return bookingRepo.findByReseller(filters.userId, {
        status: filters.status,
        limit: filters.limit,
        offset: filters.offset,
      });
    }

    return [];
  }

  /**
   * Assign driver to booking (admin only)
   */
  async assignDriver(bookingId: string, driverId: string, scheduledBy: string) {
    const booking = await this.getBookingById(bookingId);

    if (booking.status !== 'created') {
      throw new ValidationError(
        `Cannot assign driver to booking in "${booking.status}" status. Only "created" bookings can be assigned.`
      );
    }

    // Get driver info (including profile)
    const driver = await prisma.user.findUnique({
      where: { id: driverId },
      include: {
        driverProfile: true,
      },
    });

    if (!driver || driver.role !== 'driver') {
      throw new NotFoundError('Driver', driverId);
    }

    // Business rule: driver must have a completed profile before assignment
    if (!driver.driverProfile) {
      throw new ValidationError(
        'Cannot assign this driver because their vehicle profile is incomplete. Please ask the driver to complete their profile in Settings.'
      );
    }

    // Update booking
    const updatedBooking = await bookingRepo.update(booking.id, {
      status: 'scheduled',
      driverId: driverId,
      driverName: driver.name,
      scheduledBy: scheduledBy,
      scheduledAt: new Date(),
    });

    // Add status history
    await bookingRepo.addStatusHistory(booking.id, {
      status: 'scheduled',
      changedBy: scheduledBy,
      notes: `Driver ${driver.name} assigned`,
    });

    // Create job (if not already created)
    if (!booking.jobId) {
      const { JobService } = await import('./job.service');
      const jobService = new JobService();
      await jobService.createJobFromBooking(booking.id, driverId);
    }

    return this.getBookingById(booking.id);
  }

  /**
   * Update booking status
   */
  async updateStatus(
    bookingId: string,
    newStatus: BookingStatus,
    changedBy: string,
    notes?: string
  ) {
    const booking = await this.getBookingById(bookingId);

    if (!isValidBookingTransition(booking.status, newStatus)) {
      throw new ValidationError(
        `Invalid status transition from "${booking.status}" to "${newStatus}"`
      );
    }

    // Update booking with appropriate timestamp
    const updateData: any = { status: newStatus };
    if (newStatus === 'scheduled' && !booking.scheduledAt) {
      updateData.scheduledAt = new Date();
    } else if (newStatus === 'collected' && !booking.collectedAt) {
      updateData.collectedAt = new Date();
    } else if (newStatus === 'sanitised' && !booking.sanitisedAt) {
      updateData.sanitisedAt = new Date();
    } else if (newStatus === 'graded' && !booking.gradedAt) {
      updateData.gradedAt = new Date();
    } else if (newStatus === 'completed' && !booking.completedAt) {
      updateData.completedAt = new Date();
    }

    await bookingRepo.update(booking.id, updateData);

    // Add status history
    await bookingRepo.addStatusHistory(booking.id, {
      status: newStatus,
      changedBy,
      notes,
    });

    return this.getBookingById(booking.id);
  }
}
