import { Response, NextFunction } from 'express';
import { SanitisationService } from '../services/sanitisation.service';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { BookingRepository } from '../repositories/booking.repository';
import prisma from '../config/database';

const sanitisationService = new SanitisationService();
const bookingRepo = new BookingRepository();

export class SanitisationController {
  /**
   * Get sanitisation records for a booking
   */
  async getRecords(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      const { bookingId } = req.query;
      
      if (!bookingId || typeof bookingId !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'bookingId is required',
        } as ApiResponse);
      }

      // Check booking ownership for non-admin users
      if (req.user.role !== 'admin') {
        const booking = await bookingRepo.findById(bookingId);
        
        if (!booking) {
          return res.status(404).json({
            success: false,
            error: 'Booking not found',
          } as ApiResponse);
        }

        // Check if user owns this booking
        if (req.user.role === 'client') {
          // Client can view their own bookings
          const client = await prisma.client.findFirst({
            where: {
              email: req.user.email,
              tenantId: req.user.tenantId,
            },
          });
          
          if (!client || booking.clientId !== client.id) {
            return res.status(403).json({
              success: false,
              error: 'Access denied to this booking',
            } as ApiResponse);
          }
        } else if (req.user.role === 'reseller') {
          // Reseller can view bookings for their clients
          const client = await prisma.client.findFirst({
            where: {
              id: booking.clientId,
              resellerId: req.user.userId,
            },
          });
          
          if (!client) {
            return res.status(403).json({
              success: false,
              error: 'Access denied to this booking',
            } as ApiResponse);
          }
        } else {
          return res.status(403).json({
            success: false,
            error: 'Access denied',
          } as ApiResponse);
        }
      }

      const records = await sanitisationService.getSanitisationRecords(bookingId);
      
      return res.json({
        success: true,
        data: records,
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Create a sanitisation record
   */
  async createRecord(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      const { bookingId, assetId, method, methodDetails, notes } = req.body;

      if (!bookingId || !assetId || !method) {
        return res.status(400).json({
          success: false,
          error: 'bookingId, assetId, and method are required',
        } as ApiResponse);
      }

      const record = await sanitisationService.createSanitisationRecord(
        bookingId,
        assetId,
        method,
        req.user.userId,
        methodDetails,
        notes
      );

      return res.json({
        success: true,
        data: record,
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Verify a sanitisation record
   */
  async verifyRecord(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      const { id } = req.params;

      const record = await sanitisationService.verifySanitisation(id);

      return res.json({
        success: true,
        data: record,
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }
}

