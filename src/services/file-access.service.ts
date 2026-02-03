// File Access Service - Validates user permissions for file access
import { AuthenticatedRequest } from '../types';
import { AppError } from '../utils/errors';
import prisma from '../config/database';
import path from 'path';
import fs from 'fs';

export class FileAccessService {
  /**
   * Check if user has permission to access a file
   * @param filePath - Relative file path (e.g., /uploads/documents/file.pdf)
   * @param user - Authenticated user from request
   * @returns true if user has access, throws AppError if not
   */
  async checkFileAccess(filePath: string, user: AuthenticatedRequest['user']): Promise<boolean> {
    if (!user) {
      throw new AppError('Unauthorized', 401);
    }

    // Normalize file path - remove leading slash and handle different formats
    const normalizedPath = filePath.replace(/^\/+/, ''); // Remove leading slashes
    
    // Extract the relative path from uploads directory
    // File paths are stored as: /uploads/documents/file.pdf or /uploads/evidence/photos/file.jpg
    let relativePath: string;
    if (normalizedPath.startsWith('uploads/')) {
      relativePath = normalizedPath;
    } else if (normalizedPath.startsWith('/uploads/')) {
      relativePath = normalizedPath.substring(1); // Remove leading slash
    } else {
      // If path doesn't start with uploads/, it's invalid
      throw new AppError('Invalid file path', 400);
    }

    // Admin can access all files
    if (user.role === 'admin') {
      return true;
    }

    // Check if file exists in database (Document or Evidence)
    // Documents are stored with paths like: /uploads/documents/filename.pdf
    // Evidence files are stored with paths like: /uploads/evidence/photos/file.jpg or /uploads/evidence/signatures/file.png
    // File paths can also be S3 URLs or S3 keys

    // Normalize the search path - try multiple formats
    const searchPaths = [
      relativePath, // uploads/documents/file.pdf
      relativePath.replace('uploads/', '/uploads/'), // /uploads/documents/file.pdf
      relativePath.replace(/^uploads\//, ''), // documents/file.pdf (for S3 keys)
    ];

    // Extract filename for more flexible matching
    const fileName = path.basename(relativePath);

    // Check Documents table
    const document = await prisma.document.findFirst({
      where: {
        OR: [
          // Match exact path or path containing the file
          { filePath: { in: searchPaths } },
          // Match if filePath ends with the filename (handles different path formats)
          { filePath: { endsWith: fileName } },
          // Match if filePath contains the relative path
          ...searchPaths.map(sp => ({ filePath: { contains: sp } })),
        ],
      },
      include: {
        job: {
          select: {
            tenantId: true,
            bookingId: true,
          },
        },
        booking: {
          select: {
            tenantId: true,
            clientId: true,
          },
        },
      },
    });

    if (document) {
      // Check tenant access
      if (user.role === 'reseller') {
        // Reseller can access files from their tenant
        if (document.tenantId !== user.tenantId) {
          throw new AppError('Access denied: File belongs to a different tenant', 403);
        }
        return true;
      }

      if (user.role === 'client') {
        // Client can only access files from their own bookings
        if (document.tenantId !== user.tenantId) {
          throw new AppError('Access denied: File belongs to a different tenant', 403);
        }
        
        // If file is linked to a booking, check if client created it
        if (document.bookingId) {
          const booking = await prisma.booking.findUnique({
            where: { id: document.bookingId },
            select: { createdBy: true },
          });
          
          if (booking && booking.createdBy !== user.userId) {
            throw new AppError('Access denied: File belongs to a different client', 403);
          }
        }
        
        return true;
      }

      // Driver can access files from jobs they're assigned to
      if (user.role === 'driver') {
        if (document.jobId) {
          const job = await prisma.job.findUnique({
            where: { id: document.jobId },
            select: { driverId: true, tenantId: true },
          });
          
          if (job) {
            // Driver can access files from their own jobs
            if (job.driverId === user.userId) {
              return true;
            }
            // Driver can also access files from jobs in their tenant (if they're part of a tenant)
            if (user.tenantId && job.tenantId === user.tenantId) {
              return true;
            }
          }
        }
        throw new AppError('Access denied: File not associated with your jobs', 403);
      }

      // Default: deny access
      throw new AppError('Access denied', 403);
    }

    // Check Evidence table
    // Evidence photos and signatures can be stored as arrays or single strings
    // They might be stored as: /uploads/evidence/photos/file.jpg, uploads/evidence/photos/file.jpg, or evidence/photos/file.jpg
    const evidenceSearchPaths = [
      ...searchPaths,
      relativePath.replace(/^uploads\//, ''), // evidence/photos/file.jpg (S3 key format)
      fileName, // Just the filename
    ];

    // For Evidence, we need to check if the file path matches any photo or signature
    // Since Prisma doesn't support complex array queries easily, we'll fetch all evidence
    // and check in memory, but limit to recent evidence to avoid performance issues
    const allEvidence = await prisma.evidence.findMany({
      where: {
        // Limit search to evidence from the last year to improve performance
        createdAt: {
          gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        },
      },
      include: {
        job: {
          select: {
            tenantId: true,
            driverId: true,
            bookingId: true,
          },
        },
      },
      take: 1000, // Limit to recent 1000 evidence records
    });

    // Find evidence that contains this file path
    const evidence = allEvidence.find(ev => {
      // Check photos array
      const photoMatch = ev.photos.some(photo => {
        return evidenceSearchPaths.some(sp => 
          photo === sp || 
          photo === sp.replace('uploads/', '/uploads/') ||
          photo.endsWith(fileName) ||
          photo.includes(fileName)
        );
      });

      // Check signature
      const signatureMatch = ev.signature && evidenceSearchPaths.some(sp =>
        ev.signature === sp ||
        ev.signature === sp.replace('uploads/', '/uploads/') ||
        ev.signature.endsWith(fileName) ||
        ev.signature.includes(fileName)
      );

      return photoMatch || signatureMatch;
    });

    if (evidence) {
      // Check tenant access
      if (user.role === 'reseller') {
        if (evidence.job.tenantId !== user.tenantId) {
          throw new AppError('Access denied: File belongs to a different tenant', 403);
        }
        return true;
      }

      if (user.role === 'client') {
        // Client can access evidence from their bookings
        if (evidence.job.tenantId !== user.tenantId) {
          throw new AppError('Access denied: File belongs to a different tenant', 403);
        }
        
        if (evidence.job.bookingId) {
          const booking = await prisma.booking.findUnique({
            where: { id: evidence.job.bookingId },
            select: { createdBy: true },
          });
          
          if (booking && booking.createdBy !== user.userId) {
            throw new AppError('Access denied: File belongs to a different client', 403);
          }
        }
        
        return true;
      }

      if (user.role === 'driver') {
        // Driver can access evidence from their own jobs
        if (evidence.job.driverId === user.userId) {
          return true;
        }
        // Driver can also access evidence from jobs in their tenant
        if (user.tenantId && evidence.job.tenantId === user.tenantId) {
          return true;
        }
        throw new AppError('Access denied: File not associated with your jobs', 403);
      }

      throw new AppError('Access denied', 403);
    }

    // File not found in database - deny access for security
    throw new AppError('File not found or access denied', 404);
  }

  /**
   * Get the absolute file path for a relative upload path
   * @param relativePath - Relative path from uploads directory (e.g., documents/file.pdf)
   * @returns Absolute file path
   */
  getAbsoluteFilePath(relativePath: string): string {
    // Normalize the path
    const normalizedPath = relativePath.replace(/^\/+/, ''); // Remove leading slashes
    
    // Extract path after 'uploads/'
    let fileSubPath: string;
    if (normalizedPath.startsWith('uploads/')) {
      fileSubPath = normalizedPath.substring('uploads/'.length);
    } else if (normalizedPath.startsWith('/uploads/')) {
      fileSubPath = normalizedPath.substring('/uploads/'.length);
    } else {
      // If it doesn't start with uploads/, assume it's already the subpath
      fileSubPath = normalizedPath;
    }

    // Construct absolute path
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const absolutePath = path.join(uploadsDir, fileSubPath);

    // Security check: ensure the resolved path is within uploads directory
    const resolvedPath = path.resolve(absolutePath);
    const resolvedUploadsDir = path.resolve(uploadsDir);
    
    if (!resolvedPath.startsWith(resolvedUploadsDir)) {
      throw new AppError('Invalid file path: Path traversal detected', 400);
    }

    return resolvedPath;
  }
}
