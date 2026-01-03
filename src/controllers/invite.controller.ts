import { Request, Response, NextFunction } from 'express';
import { InviteService } from '../services/invite.service';
import { AuthenticatedRequest, ApiResponse } from '../types';
import prisma from '../config/database';

const inviteService = new InviteService();

export class InviteController {
  async listInvites(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      const { status, role } = req.query; // status: 'pending', 'accepted', 'expired'; role: 'client', 'reseller'

      const invites = await inviteService.listInvites({
        invitedBy: req.user.role === 'admin' ? undefined : req.user.userId, // Admin sees all, reseller sees their own
        tenantId: req.user.role === 'admin' ? undefined : req.user.tenantId, // Admin sees all tenants
        userRole: req.user.role,
        role: role as string | undefined,
        status: status as string | undefined,
      });

      return res.json({
        success: true,
        data: invites,
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }

  async createInvite(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      const { email, role } = req.body;

      // Only admins can invite drivers
      if (role === 'driver' && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Only administrators can invite drivers',
        } as ApiResponse);
      }

      // Resellers can only invite clients
      if (req.user.role === 'reseller' && role !== 'client') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Resellers can only invite clients',
        } as ApiResponse);
      }

      // Get tenant information
      const tenant = await prisma.tenant.findUnique({
        where: { id: req.user.tenantId },
      });

      if (!tenant) {
        return res.status(404).json({
          success: false,
          error: 'Tenant not found',
        } as ApiResponse);
      }

      const invite = await inviteService.createInvite({
        email,
        role,
        invitedBy: req.user.userId,
        tenantId: req.user.tenantId,
        tenantName: tenant.name,
      });

      return res.status(201).json({
        success: true,
        data: invite,
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }

  async getInviteByToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.params;

      const invite = await inviteService.getInviteByToken(token);

      if (!invite) {
        return res.status(404).json({
          success: false,
          error: 'Invitation not found or has expired',
        } as ApiResponse);
      }

      return res.json({
        success: true,
        data: invite,
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }

  async acceptInvite(req: Request, res: Response, next: NextFunction) {
    try {
      const { inviteToken, email, name, password } = req.body;

      const result = await inviteService.acceptInvite({
        inviteToken,
        email,
        name,
        password,
      });

      return res.status(201).json({
        success: true,
        data: result,
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }

  async cancelInvite(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      const { id } = req.params;

      await inviteService.cancelInvite(id, req.user.userId, req.user.tenantId);

      return res.json({
        success: true,
        message: 'Invitation cancelled successfully',
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }
}

