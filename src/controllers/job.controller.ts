import { Request, Response, NextFunction } from 'express';
import { JobService } from '../services/job.service';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { transformJobForAPI, transformJobsForAPI } from '../utils/job-transform';

const jobService = new JobService();

export class JobController {
  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const job = await jobService.getJobById(id);
      
      // Debug: Log raw job data before transformation
      console.log('[Job Controller] Raw job from DB:', {
        id: job.id,
        hasEvidence: !!job.evidence,
        evidenceType: typeof job.evidence,
        evidenceIsArray: Array.isArray(job.evidence),
        evidenceLength: Array.isArray(job.evidence) ? job.evidence.length : 'N/A',
        evidenceValue: job.evidence,
      });
      
      // Debug: Log each evidence record if it's an array
      if (Array.isArray(job.evidence)) {
        console.log('[Job Controller] Evidence records count:', job.evidence.length);
        job.evidence.forEach((ev: any, idx: number) => {
          console.log(`[Job Controller] Evidence ${idx + 1}:`, {
            id: ev.id,
            status: ev.status,
            photosCount: Array.isArray(ev.photos) ? ev.photos.length : 0,
            photos: Array.isArray(ev.photos) ? ev.photos.slice(0, 2).map((p: string) => p.substring(0, 50) + '...') : 'not array',
            hasSignature: !!ev.signature,
            signature: ev.signature ? ev.signature.substring(0, 50) + '...' : 'none',
            sealNumbersCount: Array.isArray(ev.sealNumbers) ? ev.sealNumbers.length : 0,
            hasNotes: !!ev.notes,
          });
        });
      } else if (job.evidence) {
        console.log('[Job Controller] Evidence is NOT an array, it is:', typeof job.evidence, job.evidence);
      }
      
      const transformedJob = transformJobForAPI(job as any);
      
      // Debug: Log transformed job
      console.log('[Job Controller] Transformed job:', {
        id: transformedJob.id,
        hasEvidence: !!transformedJob.evidence,
        evidenceType: typeof transformedJob.evidence,
        evidenceIsArray: Array.isArray(transformedJob.evidence),
        evidenceLength: Array.isArray(transformedJob.evidence) ? transformedJob.evidence.length : 'N/A',
        evidenceValue: transformedJob.evidence,
      });
      
      // Debug: Log each transformed evidence record if it's an array
      if (Array.isArray(transformedJob.evidence)) {
        console.log('[Job Controller] Transformed evidence records count:', transformedJob.evidence.length);
        transformedJob.evidence.forEach((ev: any, idx: number) => {
          console.log(`[Job Controller] Transformed evidence ${idx + 1}:`, {
            status: ev.status,
            photosCount: Array.isArray(ev.photos) ? ev.photos.length : 0,
            hasSignature: !!ev.signature,
            sealNumbersCount: Array.isArray(ev.sealNumbers) ? ev.sealNumbers.length : 0,
            hasNotes: !!ev.notes,
            createdAt: ev.createdAt,
          });
        });
      } else if (transformedJob.evidence) {
        console.log('[Job Controller] Transformed evidence is NOT an array, it is:', typeof transformedJob.evidence, transformedJob.evidence);
      }
      
      res.json({
        success: true,
        data: transformedJob,
      } as ApiResponse);
    } catch (error) {
      next(error);
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

      const jobs = await jobService.getJobs({
        tenantId: req.user.tenantId,
        userId: req.user.userId,
        userRole: req.user.role,
        status: req.query.status as any,
        clientName: req.query.clientName as string,
        searchQuery: req.query.searchQuery as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
      });

      const transformedJobs = transformJobsForAPI(jobs as any[]);
      res.json({
        success: true,
        data: transformedJobs,
      } as ApiResponse);
    } catch (error) {
      next(error);
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
      res.json({
        success: true,
        data: transformedJob,
      } as ApiResponse);
    } catch (error) {
      next(error);
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
      
      // Handle both direct properties and nested evidence object (frontend sends nested)
      const evidenceData = req.body.evidence || req.body;
      const { photos, signature, sealNumbers, notes, status } = evidenceData;

      // Debug: Log incoming evidence data
      console.log('[Evidence Controller] Received evidence data:', {
        jobId: id,
        bodyStructure: Object.keys(req.body),
        hasEvidenceKey: !!req.body.evidence,
        evidenceData: evidenceData,
        photosCount: Array.isArray(photos) ? photos.length : 0,
        photos: photos,
        hasSignature: !!signature,
        signature: signature ? 'present' : 'missing',
        sealNumbersCount: Array.isArray(sealNumbers) ? sealNumbers.length : 0,
        sealNumbers: sealNumbers,
        hasNotes: !!notes,
        notes: notes,
        status: status,
        fullBody: req.body,
      });

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

      const job = await jobService.updateEvidence(id, {
        photos,
        signature,
        sealNumbers,
        notes,
        status: evidenceStatus,
        uploadedBy: req.user.userId,
      });

      const transformedJob = transformJobForAPI(job as any);
      res.json({
        success: true,
        data: transformedJob,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }
}
