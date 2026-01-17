// Document Controller
import { Response, NextFunction } from 'express';
import { DocumentService } from '../services/document.service';
import { AuthenticatedRequest, ApiResponse } from '../types';
import path from 'path';
import fs from 'fs';

const documentService = new DocumentService();

export class DocumentController {
  /**
   * Get all documents for a job
   */
  async getJobDocuments(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      const { jobId } = req.params;
      const documents = await documentService.getJobDocuments(jobId);

      return res.json({
        success: true,
        data: documents,
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get all documents for a booking
   */
  async getBookingDocuments(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      const { bookingId } = req.params;
      const documents = await documentService.getBookingDocuments(bookingId);

      return res.json({
        success: true,
        data: documents,
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Download a document
   * Handles both local files and S3 URLs (presigned URLs)
   */
  async downloadDocument(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      const { id } = req.params;
      const filePath = await documentService.getDocumentPath(id);

      if (!filePath) {
        return res.status(404).json({
          success: false,
          error: 'Document not found',
        } as ApiResponse);
      }

      // Check if it's an S3 URL (http/https) - redirect to presigned URL
      if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
        // It's already a presigned URL or public S3 URL, redirect
        return res.redirect(filePath);
      }

      // Local file - check if exists and stream
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          error: 'Document not found',
        } as ApiResponse);
      }

      const fileName = path.basename(filePath);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
      return;
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get all documents for the current user (based on role)
   */
  async getMyDocuments(req: AuthenticatedRequest, res: Response, _next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      const prisma = (await import('../config/database')).default;

      let documents: any[] = [];

      if (req.user.role === 'admin') {
        // Admin sees all documents across all tenants (similar to bookings and jobs)
        // Try to include job relation, but handle if it doesn't exist (Prisma client not regenerated)
        try {
          documents = await prisma.document.findMany({
            where: {}, // No tenantId filter - admin sees all documents
            include: {
              booking: {
                select: {
                  bookingNumber: true,
                  client: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
              job: {
                select: {
                  erpJobNumber: true,
                  clientName: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          });
        } catch (error: any) {
          // If job relation doesn't exist, query without it
          if (error.message?.includes('job') || error.message?.includes('Unknown argument')) {
            const { logger } = await import('../utils/logger');
            logger.warn('Job relation not available, querying without it', { 
              requestId: req.id,
              error: error.message 
            });
            documents = await prisma.document.findMany({
              where: {}, // No tenantId filter - admin sees all documents
              include: {
                booking: {
                  select: {
                    bookingNumber: true,
                    client: {
                      select: {
                        name: true,
                      },
                    },
                  },
                },
              },
              orderBy: { createdAt: 'desc' },
            });
          } else {
            throw error;
          }
        }
      } else if (req.user.role === 'client') {
        // Client sees documents for their bookings
        const clientBookings = await prisma.booking.findMany({
          where: {
            tenantId: req.user.tenantId,
            createdBy: req.user.userId,
          },
          select: { id: true },
        });
        const bookingIds = clientBookings.map(b => b.id);

        // Get job IDs for these bookings
        const jobs = await prisma.job.findMany({
          where: { bookingId: { in: bookingIds } },
          select: { id: true },
        });
        const jobIds = jobs.map(j => j.id);

        // Try to include job relation, but handle if it doesn't exist
        try {
          documents = await prisma.document.findMany({
            where: {
              tenantId: req.user.tenantId,
              OR: [
                { bookingId: { in: bookingIds } },
                { jobId: { in: jobIds } },
              ],
            },
            include: {
              booking: {
                select: {
                  bookingNumber: true,
                  client: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
              job: {
                select: {
                  erpJobNumber: true,
                  clientName: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          });
        } catch (error: any) {
          // If job relation doesn't exist, query without it
          if (error.message?.includes('job') || error.message?.includes('Unknown argument')) {
            const { logger } = await import('../utils/logger');
            logger.warn('Job relation not available, querying without it', { 
              requestId: req.id,
              error: error.message 
            });
            documents = await prisma.document.findMany({
              where: {
                tenantId: req.user.tenantId,
                OR: [
                  { bookingId: { in: bookingIds } },
                  { jobId: { in: jobIds } },
                ],
              },
              include: {
                booking: {
                  select: {
                    bookingNumber: true,
                    client: {
                      select: {
                        name: true,
                      },
                    },
                  },
                },
              },
              orderBy: { createdAt: 'desc' },
            });
          } else {
            throw error;
          }
        }
      } else {
        // Reseller and other roles - return empty for now
        documents = [];
      }

      return res.json({
        success: true,
        data: documents || [],
      } as ApiResponse);
    } catch (error: any) {
      const { logError } = await import('../utils/logger');
      logError('Error fetching documents', error, { 
        requestId: req.id,
        userId: req.user?.userId,
        role: req.user?.role,
      });
      // Return empty array instead of failing completely
      return res.json({
        success: true,
        data: [],
      } as ApiResponse);
    }
  }
}

