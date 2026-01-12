import { Response, NextFunction } from 'express';
import { JobService } from '../services/job.service';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { transformJobForAPI, transformJobsForAPI } from '../utils/job-transform';
import { validateBase64Images, validateBase64Image } from '../utils/file-validation';
import { logger } from '../utils/logger';

const jobService = new JobService();

export class JobController {
  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const job = await jobService.getJobById(id);
      const transformedJob = transformJobForAPI(job as any);
      
      return res.json({
        success: true,
        data: transformedJob,
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }

  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      // Parse pagination parameters with defaults
      const page = req.query.page ? Math.max(1, parseInt(req.query.page as string)) : 1;
      const limit = req.query.limit ? Math.min(100, Math.max(1, parseInt(req.query.limit as string))) : 20; // Default 20, max 100
      const offset = (page - 1) * limit;

      const result = await jobService.getJobs({
        tenantId: req.user.tenantId,
        userId: req.user.userId,
        userRole: req.user.role,
        status: req.query.status as any,
        clientName: req.query.clientName as string,
        clientId: req.query.clientId as string,
        searchQuery: req.query.searchQuery as string,
        limit,
        offset,
      });

      if (!result || Array.isArray(result) || !('data' in result) || !('pagination' in result)) {
        return res.json({
          success: true,
          data: [],
          pagination: { page: 1, limit, total: 0, totalPages: 0 },
        } as ApiResponse);
      }

      const transformedJobs = transformJobsForAPI(result.data as any[]);
      
      return res.json({
        success: true,
        data: transformedJobs,
        pagination: result.pagination,
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }

  async updateStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      const { id } = req.params;
      let { status, notes } = req.body;

      // Convert frontend status format to backend format
      if (status === 'en-route') {
        status = 'en_route';
      }

      // Only drivers can mark jobs as "completed"
      if (status === 'completed' && req.user.role !== 'driver') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Only drivers can mark jobs as completed',
        } as ApiResponse);
      }

      const job = await jobService.updateStatus(
        id,
        status,
        req.user.userId,
        notes
      );

      const transformedJob = transformJobForAPI(job as any);
      return res.json({
        success: true,
        data: transformedJob,
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }

  async updateEvidence(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      const { id } = req.params;
      
      const evidenceData = req.body.evidence || req.body;
      const { photos, signature, sealNumbers, notes, status } = evidenceData;

      // Convert frontend status format to backend format
      let evidenceStatus = status;
      if (evidenceStatus === 'en-route') {
        evidenceStatus = 'en_route';
      }

      if (!evidenceStatus) {
        return res.status(400).json({
          success: false,
          error: 'Status is required for evidence submission',
        } as ApiResponse);
      }

      // Validate file uploads
      if (photos && Array.isArray(photos) && photos.length > 0) {
        try {
          validateBase64Images(photos, 'photos', 10);
        } catch (error) {
          return res.status(400).json({
            success: false,
            error: error instanceof Error ? error.message : 'Invalid photo data',
          } as ApiResponse);
        }
      }

      if (signature && typeof signature === 'string' && signature.trim().length > 0) {
        try {
          validateBase64Image(signature, 'signature');
        } catch (error) {
          return res.status(400).json({
            success: false,
            error: error instanceof Error ? error.message : 'Invalid signature data',
          } as ApiResponse);
        }
      }

      logger.debug('Evidence submission', {
        requestId: req.id,
        jobId: id,
        status: evidenceStatus,
        photosCount: Array.isArray(photos) ? photos.length : 0,
        hasSignature: !!signature,
        sealNumbersCount: Array.isArray(sealNumbers) ? sealNumbers.length : 0,
      });

      const job = await jobService.updateEvidence(id, {
        photos,
        signature,
        sealNumbers,
        notes,
        status: evidenceStatus,
        uploadedBy: req.user.userId,
      });

      const transformedJob = transformJobForAPI(job as any);
      return res.json({
        success: true,
        data: transformedJob,
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }

  async updateJourneyFields(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      const { id } = req.params;
      const {
        dial2Collection,
        securityRequirements,
        idRequired,
        loadingBayLocation,
        vehicleHeightRestrictions,
        doorLiftSize,
        roadWorksPublicEvents,
        manualHandlingRequirements,
      } = req.body;

      const job = await jobService.updateJourneyFields(id, {
        dial2Collection,
        securityRequirements,
        idRequired,
        loadingBayLocation,
        vehicleHeightRestrictions,
        doorLiftSize,
        roadWorksPublicEvents,
        manualHandlingRequirements,
      });

      const transformedJob = transformJobForAPI(job as any);
      return res.json({
        success: true,
        data: transformedJob,
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }
}
