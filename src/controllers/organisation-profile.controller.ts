import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { OrganisationProfileService, OrganisationProfileData } from '../services/organisation-profile.service';

const profileService = new OrganisationProfileService();

export class OrganisationProfileController {
  /**
   * Get organisation profile for current user
   */
  async getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      const { userId } = req.user;

      const profile = await profileService.getProfile(userId);

      if (!profile) {
        return res.json({
          success: true,
          data: null,
        } as ApiResponse);
      }

      res.json({
        success: true,
        data: profile,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create or update organisation profile
   */
  async upsertProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      const { userId } = req.user;
      const { organisationName, registrationNumber, address, email, phone } = req.body;

      const data: OrganisationProfileData = {
        organisationName,
        registrationNumber,
        address,
        email,
        phone,
      };

      const profile = await profileService.upsertProfile(userId, data);

      res.json({
        success: true,
        data: profile,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Check if profile is complete
   */
  async checkProfileComplete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      const { userId } = req.user;

      const isComplete = await profileService.isProfileComplete(userId);

      res.json({
        success: true,
        data: { isComplete },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }
}

