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

      // Check if it's an S3 URL (http/https) - proxy through backend to avoid CORS
      if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
        // Extract S3 key from URL or presigned URL
        const { extractS3KeyFromUrl, getFileFromS3, isS3Enabled } = await import('../utils/s3-storage');
        const s3Key = extractS3KeyFromUrl(filePath);
        
        if (s3Key && isS3Enabled()) {
          try {
            // Get file from S3 and stream it to client
            const s3File = await getFileFromS3(s3Key);
            
            // Extract filename from S3 key and fix extension if timestamp was appended after it
            // S3 keys are like: documents/filename.pdf-1234567890
            // We need: filename.pdf
            let fileName = path.basename(s3Key);
            
            // If filename has a timestamp suffix after the extension (e.g., file.pdf-1234567890)
            // Extract the proper filename with extension
            const timestampSuffixMatch = fileName.match(/^(.+\.(pdf|PDF))-(\d+)$/);
            if (timestampSuffixMatch) {
              // Extract filename before timestamp (e.g., "file.pdf" from "file.pdf-1234567890")
              fileName = timestampSuffixMatch[1];
            } else {
              // If no timestamp suffix, try to ensure .pdf extension is present
              // Check if it ends with .pdf (case insensitive)
              if (!fileName.toLowerCase().endsWith('.pdf')) {
                // If ContentType suggests it's a PDF, add .pdf extension
                if (s3File.ContentType?.includes('pdf')) {
                  fileName = `${fileName}.pdf`;
                }
              }
            }
            
            res.setHeader('Content-Type', s3File.ContentType || 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            if (s3File.ContentLength) {
              res.setHeader('Content-Length', s3File.ContentLength.toString());
            }
            
            // Stream the file body to response
            // AWS SDK GetObjectCommand returns Body as a Readable stream
            const stream = s3File.Body as any;
            if (stream && typeof stream.pipe === 'function') {
              // It's a readable stream, pipe it directly
              stream.pipe(res);
            } else if (stream && typeof stream[Symbol.asyncIterator] === 'function') {
              // It's an async iterable, convert to buffer
              const chunks: Buffer[] = [];
              for await (const chunk of stream) {
                chunks.push(Buffer.from(chunk));
              }
              const buffer = Buffer.concat(chunks);
              res.send(buffer);
            } else {
              // Convert to buffer if it's already a buffer or Uint8Array
              const buffer = Buffer.from(stream);
              res.send(buffer);
            }
            return;
          } catch (error) {
            const { logger } = await import('../utils/logger');
            logger.error('Failed to proxy S3 file', { error, documentId: id, s3Key });
            return res.status(500).json({
              success: false,
              error: 'Failed to download document from storage',
            } as ApiResponse);
          }
        } else {
          // If we can't extract the key or S3 is not enabled, return error
          // We should always be able to extract the key from S3 URLs
          const { logger } = await import('../utils/logger');
          logger.error('Cannot extract S3 key from URL', { documentId: id, filePath });
          return res.status(500).json({
            success: false,
            error: 'Failed to download document: Invalid file path',
          } as ApiResponse);
        }
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

