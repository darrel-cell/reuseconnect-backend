// Secure File Serving Routes
import { Router, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';
import { FileAccessService } from '../services/file-access.service';
import { AppError } from '../utils/errors';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';

const router = Router();
const fileAccessService = new FileAccessService();

/**
 * Secure file serving endpoint
 * GET /uploads/* - Serves files from uploads directory with authentication and authorization
 */
router.get('/*', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    // Get the file path from the request
    // When router is mounted at /uploads, req.path is relative to mount point
    // So /uploads/documents/file.pdf becomes /documents/file.pdf in req.path
    // req.originalUrl contains the full path: /uploads/documents/file.pdf
    const requestPath = req.path; // e.g., /documents/file.pdf
    const originalUrl = req.originalUrl; // e.g., /uploads/documents/file.pdf
    
    // Extract the path after /uploads from originalUrl
    let filePath: string;
    if (originalUrl.startsWith('/uploads/')) {
      filePath = originalUrl.substring('/uploads/'.length); // documents/file.pdf
      filePath = `uploads/${filePath}`; // uploads/documents/file.pdf
    } else {
      // Fallback: use req.path and prepend uploads/
      filePath = requestPath.replace(/^\/+/, ''); // Remove leading slashes
      filePath = `uploads/${filePath}`; // uploads/documents/file.pdf
    }

    // Check file access permissions
    await fileAccessService.checkFileAccess(filePath, req.user);

    // Get absolute file path
    const absolutePath = fileAccessService.getAbsoluteFilePath(filePath);

    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
      logger.warn('File not found', {
        requestId: req.id,
        filePath: absolutePath,
        userId: req.user.userId,
        role: req.user.role,
      });
      return res.status(404).json({
        success: false,
        error: 'File not found',
      });
    }

    // Get file stats
    const stats = fs.statSync(absolutePath);
    if (!stats.isFile()) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file path',
      });
    }

    // Determine content type based on file extension
    const ext = path.extname(absolutePath).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.txt': 'text/plain',
      '.json': 'application/json',
    };
    const contentType = contentTypes[ext] || 'application/octet-stream';

    // Set headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stats.size.toString());
    
    // For images, allow inline display; for PDFs and other files, suggest download
    if (ext.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      res.setHeader('Content-Disposition', `inline; filename="${path.basename(absolutePath)}"`);
    } else {
      res.setHeader('Content-Disposition', `attachment; filename="${path.basename(absolutePath)}"`);
    }

    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=3600'); // Cache for 1 hour

    // Stream the file
    const fileStream = fs.createReadStream(absolutePath);
    fileStream.pipe(res);

    // Log successful file access
    logger.info('File served', {
      requestId: req.id,
      filePath: filePath,
      userId: req.user.userId,
      role: req.user.role,
      size: stats.size,
    });

  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    }
    
    logger.error('Error serving file', error as Error, {
      requestId: req.id,
      path: req.path,
      userId: req.user?.userId,
    });
    
    return next(error);
  }
});

export default router;
