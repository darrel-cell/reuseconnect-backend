import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import prisma from '../config/database';
import { AuthenticatedRequest, ApiResponse } from '../types';

const router = Router();

router.use(authenticate);

// Get users (admin sees all users across all tenants)
router.get(
  '/',
  authorize('admin'),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      // Build where clause - admins see all users (no tenantId filter)
      const where: any = {};
      
      // Filter by role if provided
      if (req.query.role) {
        where.role = req.query.role;
      }
      
      // Filter by status if provided
      if (req.query.status) {
        where.status = req.query.status;
      }
      
      // Filter by tenantId if provided
      if (req.query.tenantId) {
        where.tenantId = req.query.tenantId;
      }
      
      // Filter by isActive if provided (convert to status filter)
      if (req.query.isActive !== undefined) {
        const isActive = req.query.isActive === 'true' || req.query.isActive === true;
        where.status = isActive ? 'active' : { not: 'active' };
      }

      const users = await prisma.user.findMany({
        where,
        include: {
          tenant: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      // Transform users to match frontend ExtendedUser interface
      const transformedUsers = users.map(user => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        tenantId: user.tenantId,
        tenantName: user.tenant?.name || '',
        avatar: user.avatar || undefined,
        createdAt: user.createdAt.toISOString(),
        isActive: user.status === 'active', // For backwards compatibility
        lastLogin: undefined, // TODO: Track last login if needed
        invitedBy: undefined, // TODO: Get from Invite table if needed
      }));

      return res.json({
        success: true,
        data: transformedUsers,
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }
);

// Get user by ID
router.get(
  '/:id',
  authorize('admin'),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      const user = await prisma.user.findUnique({
        where: { id: req.params.id },
        include: {
          tenant: true,
        },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        } as ApiResponse);
      }

      // Transform user to match frontend ExtendedUser interface
      const transformedUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        tenantId: user.tenantId,
        tenantName: user.tenant?.name || '',
        avatar: user.avatar || undefined,
        createdAt: user.createdAt.toISOString(),
        isActive: user.status === 'active',
        lastLogin: undefined,
        invitedBy: undefined,
      };

      return res.json({
        success: true,
        data: transformedUser,
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }
);

// Update user status (activate/deactivate)
router.patch(
  '/:id/status',
  authorize('admin'),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      const { id } = req.params;
      const { isActive } = req.body;

      // Validate input
      if (typeof isActive !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'isActive must be a boolean',
        } as ApiResponse);
      }

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id },
        include: {
          tenant: true,
        },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: `User with ID "${id}" was not found.`,
        } as ApiResponse);
      }

      // Prevent admin from deactivating themselves
      if (id === req.user.userId && !isActive) {
        return res.status(403).json({
          success: false,
          error: 'You cannot deactivate your own account',
        } as ApiResponse);
      }

      // Determine new status
      // If activating, set to 'active' (pending users should be approved separately)
      // If deactivating, set to 'inactive' (unless currently 'pending', then keep as 'pending')
      let newStatus: 'pending' | 'active' | 'inactive';
      if (isActive) {
        // Activating: set to active (pending users will be handled by approve endpoint)
        newStatus = 'active';
      } else {
        // Deactivating: if pending, keep pending; otherwise set to inactive
        newStatus = user.status === 'pending' ? 'pending' : 'inactive';
      }

      // Update user status
      const updatedUser = await prisma.user.update({
        where: { id },
        data: { status: newStatus },
        include: {
          tenant: true,
        },
      });

      // Transform user to match frontend ExtendedUser interface
      const transformedUser = {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        status: updatedUser.status,
        tenantId: updatedUser.tenantId,
        tenantName: updatedUser.tenant?.name || '',
        avatar: updatedUser.avatar || undefined,
        createdAt: updatedUser.createdAt.toISOString(),
        isActive: updatedUser.status === 'active',
        lastLogin: undefined,
        invitedBy: undefined,
      };

      return res.json({
        success: true,
        data: transformedUser,
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }
);

// Approve user (change from pending to active)
router.patch(
  '/:id/approve',
  authorize('admin'),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      const { id } = req.params;

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id },
        include: {
          tenant: true,
        },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: `User with ID "${id}" was not found.`,
        } as ApiResponse);
      }

      // Only approve if status is pending
      if (user.status !== 'pending') {
        return res.status(400).json({
          success: false,
          error: `User is not in pending status. Current status: ${user.status || 'unknown'}`,
        } as ApiResponse);
      }

      // Update user status to active
      const updatedUser = await prisma.user.update({
        where: { id },
        data: { status: 'active' },
        include: {
          tenant: true,
        },
      });

      // Transform user to match frontend ExtendedUser interface
      const transformedUser = {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        status: updatedUser.status,
        tenantId: updatedUser.tenantId,
        tenantName: updatedUser.tenant?.name || '',
        avatar: updatedUser.avatar || undefined,
        createdAt: updatedUser.createdAt.toISOString(),
        isActive: updatedUser.status === 'active',
        lastLogin: undefined,
        invitedBy: undefined,
      };

      return res.json({
        success: true,
        data: transformedUser,
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }
);

export default router;

