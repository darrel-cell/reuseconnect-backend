import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types';
import prisma from '../config/database';
import { BookingRepository } from '../repositories/booking.repository';
import { JobRepository } from '../repositories/job.repository';

const bookingRepo = new BookingRepository();
const jobRepo = new JobRepository();

export class DashboardController {
  async getStats(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      const { tenantId, role, userId } = req.user;

      // Get jobs based on role (include booking to access roundTripDistanceKm)
      let jobs: any[] = [];
      if (role === 'admin') {
        // Admins should see all jobs across all tenants (no tenantId filter)
        jobs = await prisma.job.findMany({
          where: {}, // No tenantId filter - admin sees all jobs
          include: { booking: true },
        });
      } else if (role === 'driver') {
        jobs = await prisma.job.findMany({
          where: { driverId: userId, tenantId },
          include: { booking: true },
        });
      } else if (role === 'client') {
        // Clients see jobs for bookings for their Client record(s) or bookings they created
        // First, find the Client record(s) associated with this user (by email and tenantId)
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true },
        });
        
        let bookingIds: string[] = [];
        
        if (user) {
          // Find all Client records with matching email and tenantId
          const clientRecords = await prisma.client.findMany({
            where: {
              email: user.email,
              tenantId: tenantId,
            },
            select: { id: true },
          });
          
          const clientIds = clientRecords.map(c => c.id);
          
          // Get bookings for these Client records OR bookings they created themselves
          const bookings = await prisma.booking.findMany({
            where: {
              tenantId,
              OR: [
                { clientId: { in: clientIds } },
                { createdBy: userId },
              ],
            },
            select: { id: true },
          });
          
          bookingIds = bookings.map(b => b.id);
        }
        
        if (bookingIds.length > 0) {
          jobs = await prisma.job.findMany({
            where: {
              tenantId,
              bookingId: { in: bookingIds },
            },
            include: { booking: true },
          });
        }
      } else if (role === 'reseller') {
        const bookings = await bookingRepo.findByReseller(userId);
        const bookingIds = bookings.map(b => b.id);
        jobs = await prisma.job.findMany({
          where: {
            tenantId,
            bookingId: { in: bookingIds },
          },
          include: { booking: true },
        });
      }

      // Calculate stats
      const totalJobs = jobs.length;
      // For drivers, exclude jobs at "warehouse" or later (those should only appear in Job History)
      // For other roles, exclude "completed" and "cancelled" jobs
      const activeJobs = role === 'driver'
        ? jobs.filter(j => !['warehouse', 'sanitised', 'graded', 'completed', 'cancelled'].includes(j.status)).length
        : jobs.filter(j => j.status !== 'completed' && j.status !== 'cancelled').length;
      const totalCO2eSaved = jobs.reduce((sum, j) => sum + (j.co2eSaved || 0), 0);
      const totalBuyback = jobs.reduce((sum, j) => sum + (j.buybackValue || 0), 0);
      
      // Calculate total assets
      const allAssets = await prisma.jobAsset.findMany({
        where: {
          jobId: { in: jobs.map(j => j.id) },
        },
      });
      const totalAssets = allAssets.reduce((sum, a) => sum + a.quantity, 0);

      // Calculate charity percent average
      const avgCharityPercent = jobs.length > 0
        ? Math.round(jobs.reduce((sum, j) => sum + (j.charityPercent || 0), 0) / jobs.length)
        : 0;

      // Calculate travel emissions breakdown
      const totalTravelEmissions = jobs.reduce((sum, j) => sum + (j.travelEmissions || 0), 0);
      
      // Sum up actual round trip distances from bookings (more accurate than deriving from emissions)
      // Use booking's roundTripDistanceKm if available, otherwise estimate from emissions
      const avgEmissionsPerKm = 0.24; // Fallback for jobs without booking distance
      let totalDistanceKm = 0;
      for (const job of jobs) {
        if (job.booking?.roundTripDistanceKm) {
          // Use actual distance from booking
          totalDistanceKm += job.booking.roundTripDistanceKm;
        } else if (job.travelEmissions && job.travelEmissions > 0) {
          // Fallback: estimate from emissions if booking distance not available
          totalDistanceKm += job.travelEmissions / avgEmissionsPerKm;
        }
      }

      // Separate completed and booked jobs
      const completedJobs = jobs.filter(j => j.status === 'completed');
      const bookedJobs = jobs.filter(j => j.status !== 'completed');

      const stats = {
        totalJobs,
        activeJobs,
        totalCO2eSaved,
        totalBuyback,
        totalAssets,
        avgCharityPercent,
        travelEmissions: {
          petrol: totalTravelEmissions * (0.21 / avgEmissionsPerKm),
          diesel: totalTravelEmissions * (0.19 / avgEmissionsPerKm),
          electric: 0,
          totalDistanceKm,
          totalDistanceMiles: totalDistanceKm * 0.621371,
        },
        completedJobsCount: completedJobs.length,
        bookedJobsCount: bookedJobs.length,
        completedCO2eSaved: completedJobs.reduce((sum, j) => sum + (j.co2eSaved || 0), 0),
        estimatedCO2eSaved: bookedJobs.reduce((sum, j) => sum + (j.co2eSaved || 0), 0),
      };

      res.json({
        success: true,
        data: stats,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }
}

