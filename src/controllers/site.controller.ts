// Site Controller
import { Response, NextFunction } from 'express';
import { SiteService } from '../services/site.service';
import { AuthenticatedRequest } from '../types';
import { ApiResponse } from '../types';

const siteService = new SiteService();

export class SiteController {
  /**
   * Get all sites
   * GET /sites?clientId=xxx (optional)
   */
  async getSites(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { clientId } = req.query;
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }
      const userId = req.user.userId;
      const tenantId = req.user.tenantId;
      const userRole = req.user.role;

      const sites = await siteService.getSites(
        userId,
        tenantId,
        userRole,
        clientId as string | undefined
      );

      return res.json({
        success: true,
        data: sites,
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get site by ID
   * GET /sites/:id
   */
  async getSiteById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }
      const userId = req.user.userId;
      const tenantId = req.user.tenantId;
      const userRole = req.user.role;

      const site = await siteService.getSiteById(id, userId, tenantId, userRole);

      return res.json({
        success: true,
        data: site,
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Create a new site
   * POST /sites
   */
  async createSite(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { name, address, postcode, lat, lng, contactName, contactPhone, clientId } = req.body;
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }
      const userId = req.user.userId;
      const tenantId = req.user.tenantId;
      const userRole = req.user.role;

      const site = await siteService.createSite(
        {
          name,
          address,
          postcode,
          lat,
          lng,
          contactName,
          contactPhone,
          clientId,
        },
        userId,
        tenantId,
        userRole
      );

      return res.status(201).json({
        success: true,
        data: site,
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Update a site
   * PUT /sites/:id
   */
  async updateSite(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { name, address, postcode, lat, lng, contactName, contactPhone } = req.body;
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }
      const userId = req.user.userId;
      const tenantId = req.user.tenantId;
      const userRole = req.user.role;

      const site = await siteService.updateSite(
        id,
        {
          name,
          address,
          postcode,
          lat,
          lng,
          contactName,
          contactPhone,
        },
        userId,
        tenantId,
        userRole
      );

      return res.json({
        success: true,
        data: site,
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Delete a site
   * DELETE /sites/:id
   */
  async deleteSite(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }
      const userId = req.user.userId;
      const tenantId = req.user.tenantId;
      const userRole = req.user.role;

      await siteService.deleteSite(id, userId, tenantId, userRole);

      return res.json({
        success: true,
        message: 'Site deleted successfully',
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }
}
