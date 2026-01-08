import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import prisma from '../config/database';
import { AuthenticatedRequest, ApiResponse } from '../types';

const router = Router();

router.use(authenticate);

// Get sites (clients see their own sites, admin sees all)
router.get(
  '/',
  authorize('admin', 'client'),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      let sites;

      if (req.user.role === 'admin') {
        // Admin sees all sites across all tenants (no tenantId filter)
        sites = await prisma.site.findMany({
          where: {}, // No tenantId filter - admin sees all sites
          include: {
            client: true,
          },
          orderBy: { name: 'asc' },
        });
      } else if (req.user.role === 'client') {
        // Clients see sites for their Client record(s)
        // Find Client record(s) associated with the user's tenantId
        const clients = await prisma.client.findMany({
          where: { tenantId: req.user.tenantId },
        });

        if (clients.length === 0) {
          // No client record found, return empty array
          sites = [];
        } else {
          const clientIds = clients.map(c => c.id);
          sites = await prisma.site.findMany({
            where: {
              tenantId: req.user.tenantId,
              clientId: { in: clientIds },
            },
            include: {
              client: true,
            },
            orderBy: { name: 'asc' },
          });
        }
      } else {
        sites = [];
      }

      // Transform sites to match frontend interface
      const transformedSites = sites.map(site => ({
        id: site.id,
        name: site.name,
        address: site.address,
        postcode: site.postcode,
        city: site.address.split(',').pop()?.trim() || '', // Extract city from address if possible
        coordinates: site.lat && site.lng ? { lat: site.lat, lng: site.lng } : undefined,
        contactName: site.contactName || undefined,
        contactPhone: site.contactPhone || undefined,
        clientId: site.clientId,
        clientName: site.client?.name || '',
      }));

      return res.json({
        success: true,
        data: transformedSites,
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }
);

// Get site by ID
router.get(
  '/:id',
  authorize('admin', 'client'),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      const site = await prisma.site.findUnique({
        where: { id: req.params.id },
        include: {
          client: true,
        },
      });

      if (!site) {
        return res.status(404).json({
          success: false,
          error: 'Site not found',
        } as ApiResponse);
      }

      // Check access - admins can access any site, others must belong to same tenant
      if (req.user.role !== 'admin' && site.tenantId !== req.user.tenantId) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
        } as ApiResponse);
      }

      // For client role, verify site belongs to their client
      if (req.user.role === 'client') {
        const clients = await prisma.client.findMany({
          where: { tenantId: req.user.tenantId },
        });
        const clientIds = clients.map(c => c.id);
        
        if (!clientIds.includes(site.clientId)) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden',
          } as ApiResponse);
        }
      }

      // Transform site to match frontend interface
      const transformedSite = {
        id: site.id,
        name: site.name,
        address: site.address,
        postcode: site.postcode,
        city: site.address.split(',').pop()?.trim() || '',
        coordinates: site.lat && site.lng ? { lat: site.lat, lng: site.lng } : undefined,
        contactName: site.contactName || undefined,
        contactPhone: site.contactPhone || undefined,
        clientId: site.clientId,
        clientName: site.client?.name || '',
      };

      return res.json({
        success: true,
        data: transformedSite,
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }
);

// Create site (admin and client can create)
router.post(
  '/',
  authorize('admin', 'client'),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      const { name, address, postcode, lat, lng, contactName, contactPhone, clientId } = req.body;

      // Validate required fields
      if (!name || !address || !postcode) {
        return res.status(400).json({
          success: false,
          error: 'Name, address, and postcode are required',
        } as ApiResponse);
      }

      let actualClientId: string;

      if (req.user.role === 'client') {
        // For client role, find or use the client record for their tenant
        const clients = await prisma.client.findMany({
          where: { tenantId: req.user.tenantId },
        });

        if (clients.length === 0) {
          // Create a client record for this tenant
          const newClient = await prisma.client.create({
            data: {
              tenantId: req.user.tenantId,
              name: req.user.email.split('@')[0] || 'Client',
              status: 'active',
            },
          });
          actualClientId = newClient.id;
        } else {
          // Use the first client record (or specified one if provided and valid)
          if (clientId && clients.some(c => c.id === clientId)) {
            actualClientId = clientId;
          } else {
            actualClientId = clients[0].id;
          }
        }
      } else {
        // Admin must provide clientId
        if (!clientId) {
          return res.status(400).json({
            success: false,
            error: 'clientId is required for admin users',
          } as ApiResponse);
        }

        // Verify client exists and belongs to tenant
        const client = await prisma.client.findFirst({
          where: {
            id: clientId,
            tenantId: req.user.tenantId,
          },
        });

        if (!client) {
          return res.status(404).json({
            success: false,
            error: 'Client not found',
          } as ApiResponse);
        }

        actualClientId = clientId;
      }

      // Create site
      const site = await prisma.site.create({
        data: {
          clientId: actualClientId,
          tenantId: req.user.tenantId,
          name,
          address,
          postcode,
          lat: lat ? parseFloat(lat) : undefined,
          lng: lng ? parseFloat(lng) : undefined,
          contactName,
          contactPhone,
        },
        include: {
          client: true,
        },
      });

      // Transform site to match frontend interface
      const transformedSite = {
        id: site.id,
        name: site.name,
        address: site.address,
        postcode: site.postcode,
        city: site.address.split(',').pop()?.trim() || '',
        coordinates: site.lat && site.lng ? { lat: site.lat, lng: site.lng } : undefined,
        contactName: site.contactName || undefined,
        contactPhone: site.contactPhone || undefined,
        clientId: site.clientId,
        clientName: site.client?.name || '',
      };

      return res.status(201).json({
        success: true,
        data: transformedSite,
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }
);

// Update site (admin and client can update their own sites)
router.put(
  '/:id',
  authorize('admin', 'client'),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      const site = await prisma.site.findUnique({
        where: { id: req.params.id },
        include: {
          client: true,
        },
      });

      if (!site) {
        return res.status(404).json({
          success: false,
          error: 'Site not found',
        } as ApiResponse);
      }

      // Check access - admins can access any site, others must belong to same tenant
      if (req.user.role !== 'admin' && site.tenantId !== req.user.tenantId) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
        } as ApiResponse);
      }

      // For client role, verify site belongs to their client
      if (req.user.role === 'client') {
        const clients = await prisma.client.findMany({
          where: { tenantId: req.user.tenantId },
        });
        const clientIds = clients.map(c => c.id);
        
        if (!clientIds.includes(site.clientId)) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden',
          } as ApiResponse);
        }
      }

      const { name, address, postcode, lat, lng, contactName, contactPhone } = req.body;

      // Update site
      const updatedSite = await prisma.site.update({
        where: { id: req.params.id },
        data: {
          ...(name && { name }),
          ...(address && { address }),
          ...(postcode && { postcode }),
          ...(lat !== undefined && { lat: lat ? parseFloat(lat) : null }),
          ...(lng !== undefined && { lng: lng ? parseFloat(lng) : null }),
          ...(contactName !== undefined && { contactName }),
          ...(contactPhone !== undefined && { contactPhone }),
        },
        include: {
          client: true,
        },
      });

      // Transform site to match frontend interface
      const transformedSite = {
        id: updatedSite.id,
        name: updatedSite.name,
        address: updatedSite.address,
        postcode: updatedSite.postcode,
        city: updatedSite.address.split(',').pop()?.trim() || '',
        coordinates: updatedSite.lat && updatedSite.lng ? { lat: updatedSite.lat, lng: updatedSite.lng } : undefined,
        contactName: updatedSite.contactName || undefined,
        contactPhone: updatedSite.contactPhone || undefined,
        clientId: updatedSite.clientId,
        clientName: updatedSite.client?.name || '',
      };

      return res.json({
        success: true,
        data: transformedSite,
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }
);

// Delete site (admin and client can delete their own sites)
router.delete(
  '/:id',
  authorize('admin', 'client'),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      const site = await prisma.site.findUnique({
        where: { id: req.params.id },
      });

      if (!site) {
        return res.status(404).json({
          success: false,
          error: 'Site not found',
        } as ApiResponse);
      }

      // Check access - admins can access any site, others must belong to same tenant
      if (req.user.role !== 'admin' && site.tenantId !== req.user.tenantId) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
        } as ApiResponse);
      }

      // For client role, verify site belongs to their client
      if (req.user.role === 'client') {
        const clients = await prisma.client.findMany({
          where: { tenantId: req.user.tenantId },
        });
        const clientIds = clients.map(c => c.id);
        
        if (!clientIds.includes(site.clientId)) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden',
          } as ApiResponse);
        }
      }

      await prisma.site.delete({
        where: { id: req.params.id },
      });

      return res.json({
        success: true,
        message: 'Site deleted successfully',
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }
);

export default router;

