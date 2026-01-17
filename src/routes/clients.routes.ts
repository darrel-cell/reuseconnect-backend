import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import prisma from '../config/database';
import { AuthenticatedRequest, ApiResponse } from '../types';

const router = Router();

router.use(authenticate);

// Get clients (admin sees all, reseller sees their clients)
router.get(
  '/',
  authorize('admin', 'reseller'),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      // Build where clause based on role
      const where: any = {};
      
      if (req.user.role === 'admin') {
        // Admins see all clients across all tenants (no tenantId filter)
        // No additional filtering needed - empty where clause means all clients
      } else if (req.user.role === 'reseller') {
        // Resellers only see clients they invited (filtered by resellerId)
        // Also filter by tenantId for resellers (they work within their tenant)
        where.tenantId = req.user.tenantId;
        where.resellerId = req.user.userId;
      }
      
      // Filter by status if provided (e.g., 'active' for booking page)
      if (req.query.status) {
        where.status = req.query.status;
      }

      // Search query filter
      if (req.query.searchQuery) {
        where.OR = [
          { name: { contains: req.query.searchQuery as string, mode: 'insensitive' } },
          { email: { contains: req.query.searchQuery as string, mode: 'insensitive' } },
          { organisationName: { contains: req.query.searchQuery as string, mode: 'insensitive' } },
        ];
      }

      // Parse pagination parameters with defaults
      const page = req.query.page ? Math.max(1, parseInt(req.query.page as string)) : 1;
      const limit = req.query.limit ? Math.min(100, Math.max(1, parseInt(req.query.limit as string))) : 20; // Default 20, max 100
      const offset = (page - 1) * limit;

      // Get clients with pagination
      const [clients, total] = await Promise.all([
        prisma.client.findMany({
          where,
          select: {
            id: true,
            name: true,
            organisationName: true,
            tenantId: true,
            email: true,
            phone: true,
            resellerId: true,
            resellerName: true,
            status: true,
            createdAt: true,
            tenant: {
              select: {
                id: true,
                name: true,
              },
            },
            _count: {
              select: {
                bookings: true,
              },
            },
          },
          orderBy: { name: 'asc' },
          take: limit,
          skip: offset,
        }),
        prisma.client.count({ where }),
      ]);

      // Fetch user status for each client (linked by email)
      const clientEmails = clients.map(c => c.email).filter((email): email is string => !!email);
      const users = await prisma.user.findMany({
        where: {
          email: { in: clientEmails },
          role: 'client',
        },
        select: {
          email: true,
          status: true,
          id: true,
        },
      });

      // Create a map of email to user status
      const userStatusMap = new Map(users.map(u => [u.email, { status: u.status, userId: u.id }]));

      // Transform clients to match frontend interface
      const transformedClients = clients.map(client => {
        const userInfo = client.email ? userStatusMap.get(client.email) : null;
        // User status takes precedence - if user is pending, show pending even if client.status is active
        const displayStatus = userInfo?.status === 'pending' ? 'pending' : client.status;
        
        return {
          id: client.id,
          name: client.name,
          organisationName: client.organisationName || undefined,
          tenantId: client.tenantId,
          tenantName: client.tenant?.name || '',
          email: client.email || '',
          contactName: client.name, // Use name as contact name
          contactPhone: client.phone || '',
          resellerId: client.resellerId,
          resellerName: client.resellerName,
          status: displayStatus, // Use user status if pending, otherwise client status
          userStatus: userInfo?.status, // Include user status separately for reference
          userId: userInfo?.userId, // Include userId for approval
          createdAt: client.createdAt.toISOString(),
          totalBookings: client._count.bookings,
          totalJobs: 0, // TODO: Calculate from jobs linked to bookings
          totalValue: 0, // TODO: Calculate from bookings/jobs
        };
      });

      return res.json({
        success: true,
        data: transformedClients,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }
);

// Get client by ID
router.get(
  '/:id',
  authorize('admin', 'reseller'),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      const client = await prisma.client.findUnique({
        where: { id: req.params.id },
        include: {
          tenant: true,
          bookings: {
            orderBy: { createdAt: 'desc' },
          },
          sites: true,
          _count: {
            select: {
              bookings: true,
            },
          },
        },
      });

      if (!client) {
        return res.status(404).json({
          success: false,
          error: 'Client not found',
        } as ApiResponse);
      }

      // Check access
      // Admins can access any client (no restrictions)
      // Resellers can only access clients they invited (must be in their tenant and have their resellerId)
      if (req.user.role === 'reseller') {
        if (client.tenantId !== req.user.tenantId) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden: Client not in your tenant',
          } as ApiResponse);
        }
        if (client.resellerId !== req.user.userId) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden: You can only access clients you have invited',
          } as ApiResponse);
        }
      }

      // Transform client to match frontend interface
      const transformedClient = {
        id: client.id,
        name: client.name,
        organisationName: client.organisationName || undefined,
        tenantId: client.tenantId,
        tenantName: client.tenant?.name || '',
        email: client.email || '',
        contactName: client.name,
        contactPhone: client.phone || '',
        resellerId: client.resellerId,
        resellerName: client.resellerName,
        status: client.status,
        createdAt: client.createdAt.toISOString(),
        totalBookings: client._count.bookings,
        totalJobs: 0, // TODO: Calculate from jobs
        totalValue: 0, // TODO: Calculate from bookings/jobs
      };

      return res.json({
        success: true,
        data: transformedClient,
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }
);

// Get client profile by user (for client role - they can view their own profile)
router.get(
  '/profile/me',
  authorize('client'),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      // Find client by user email
      const client = await prisma.client.findFirst({
        where: {
          email: req.user.email,
          tenantId: req.user.tenantId,
        },
        include: {
          tenant: true,
        },
      });

      if (!client) {
        return res.status(404).json({
          success: false,
          error: 'Client profile not found',
        } as ApiResponse);
      }

      return res.json({
        success: true,
        data: {
          id: client.id,
          name: client.name,
          email: client.email || '',
          phone: client.phone || '',
          organisationName: client.organisationName || '',
          registrationNumber: client.registrationNumber || '',
          address: client.address || '',
          hasProfile: !!(client.email && client.phone && client.organisationName && client.registrationNumber && client.address),
        },
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }
);

// Update client profile (for client role - they can update their own profile)
router.patch(
  '/profile/me',
  authorize('client'),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      const { name, email, phone, organisationName, registrationNumber, address } = req.body;

      // Validate required fields
      if (!name || !email || !phone || !organisationName || !registrationNumber || !address) {
        return res.status(400).json({
          success: false,
          error: 'Name, email, phone, organisation name, registration number, and address are required',
        } as ApiResponse);
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid email format',
        } as ApiResponse);
      }

      // Find client by user email
      const client = await prisma.client.findFirst({
        where: {
          email: req.user.email,
          tenantId: req.user.tenantId,
        },
      });

      if (!client) {
        return res.status(404).json({
          success: false,
          error: 'Client profile not found',
        } as ApiResponse);
      }

      // Update user name
      const updatedUser = await prisma.user.update({
        where: { id: req.user.userId },
        data: { name: name.trim() },
        select: { name: true },
      });

      // Update client profile
      const updatedClient = await prisma.client.update({
        where: { id: client.id },
        data: {
          email,
          phone,
          organisationName,
          registrationNumber,
          address,
        },
        include: {
          tenant: true,
        },
      });

      return res.json({
        success: true,
        data: {
          id: updatedClient.id,
          name: updatedUser.name, // Return updated user name
          email: updatedClient.email || '',
          phone: updatedClient.phone || '',
          organisationName: updatedClient.organisationName || '',
          registrationNumber: updatedClient.registrationNumber || '',
          address: updatedClient.address || '',
          hasProfile: !!(updatedClient.email && updatedClient.phone && updatedClient.organisationName && updatedClient.registrationNumber && updatedClient.address),
        },
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }
);

// Update client status (admin can update all, reseller can update their invited clients)
router.patch(
  '/:id/status',
  authorize('admin', 'reseller'),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      const { id } = req.params;
      const { status } = req.body;

      // Validate status
      if (!['active', 'inactive'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid status. Must be one of: active, inactive',
        } as ApiResponse);
      }

      // Check if client exists
      // Admins can access any client, resellers can only access clients in their tenant
      const whereClause: any = { id };
      
      if (req.user.role === 'reseller') {
        // Resellers can only access clients in their tenant
        whereClause.tenantId = req.user.tenantId;
      }
      // Admins can access any client (no tenantId filter)
      
      const client = await prisma.client.findFirst({
        where: whereClause,
      });

      if (!client) {
        return res.status(404).json({
          success: false,
          error: `Client with ID "${id}" was not found.`,
        } as ApiResponse);
      }

      // Resellers can only update clients they invited
      if (req.user.role === 'reseller' && client.resellerId !== req.user.userId) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: You can only manage clients you have invited',
        } as ApiResponse);
      }

      // Update client status
      const updatedClient = await prisma.client.update({
        where: { id },
        data: { status },
        include: {
          tenant: true,
          bookings: {
            take: 5,
            orderBy: { createdAt: 'desc' },
          },
          _count: {
            select: {
              bookings: true,
            },
          },
        },
      });

      // Transform client to match frontend interface
      const transformedClient = {
        id: updatedClient.id,
        name: updatedClient.name,
        organisationName: updatedClient.organisationName || undefined,
        tenantId: updatedClient.tenantId,
        tenantName: updatedClient.tenant?.name || '',
        email: updatedClient.email || '',
        contactName: updatedClient.name,
        contactPhone: updatedClient.phone || '',
        resellerId: updatedClient.resellerId,
        resellerName: updatedClient.resellerName,
        status: updatedClient.status,
        createdAt: updatedClient.createdAt.toISOString(),
        totalBookings: updatedClient._count.bookings,
        totalJobs: 0, // TODO: Calculate from jobs
        totalValue: 0, // TODO: Calculate from bookings/jobs
      };

      return res.json({
        success: true,
        data: transformedClient,
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }
);

export default router;

