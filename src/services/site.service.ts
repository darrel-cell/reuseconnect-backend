// Site Service
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { NotFoundError, ValidationError } from '../utils/errors';

export interface CreateSiteData {
  name: string;
  address: string;
  postcode: string;
  lat?: number;
  lng?: number;
  contactName?: string;
  contactPhone?: string;
  clientId?: string; // Optional - if not provided, uses current user's client
}

export interface UpdateSiteData {
  name?: string;
  address?: string;
  postcode?: string;
  lat?: number;
  lng?: number;
  contactName?: string;
  contactPhone?: string;
}

export class SiteService {
  /**
   * Get all sites
   * - Clients see only their own sites
   * - Admins see all sites
   * - Resellers see sites of their clients
   */
  async getSites(userId: string, tenantId: string, userRole: string, clientId?: string) {
    try {
      const where: any = { tenantId };

      // If user is a client, only show their sites
      if (userRole === 'client') {
        // Get user's client ID by email (same logic as booking service)
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, tenantId: true },
        });

        if (!user || !user.email) {
          throw new NotFoundError('User', userId);
        }

        // Find client by email within the tenant
        const client = await prisma.client.findFirst({
          where: {
            tenantId: user.tenantId,
            email: user.email,
          },
        });

        if (client) {
          where.clientId = client.id;
        } else {
          // If no client found, return empty array
          return [];
        }
      } else if (userRole === 'reseller') {
        // Resellers see sites of their clients
        const resellerClients = await prisma.client.findMany({
          where: {
            tenantId,
            resellerId: userId,
            status: 'active',
          },
        });

        if (resellerClients.length > 0) {
          where.clientId = {
            in: resellerClients.map(c => c.id),
          };
        } else {
          return [];
        }
      } else if (userRole === 'admin') {
        // Admins see all sites
        // If clientId is provided, filter by it
        if (clientId) {
          where.clientId = clientId;
        }
      }

      const sites = await prisma.site.findMany({
        where,
        include: {
          client: {
            select: {
              id: true,
              name: true,
              organisationName: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return sites;
    } catch (error) {
      logger.error('Error getting sites', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Get site by ID
   */
  async getSiteById(siteId: string, userId: string, tenantId: string, userRole: string) {
    try {
      const site = await prisma.site.findUnique({
        where: { id: siteId },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              organisationName: true,
            },
          },
        },
      });

      if (!site) {
        throw new NotFoundError('Site', siteId);
      }

      // Check permissions
      if (site.tenantId !== tenantId) {
        throw new ValidationError('Access denied to this site');
      }

      // If user is a client, verify they own this site
      if (userRole === 'client') {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, tenantId: true },
        });

        if (user && user.email) {
          const client = await prisma.client.findFirst({
            where: {
              tenantId: user.tenantId,
              email: user.email,
            },
          });

          if (client && site.clientId !== client.id) {
            throw new ValidationError('Access denied to this site');
          }
        }
      }

      return site;
    } catch (error) {
      logger.error('Error getting site by ID', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Create a new site
   * Automatically determines clientId based on user role
   */
  async createSite(data: CreateSiteData, userId: string, tenantId: string, userRole: string) {
    try {
      // Validate required fields
      if (!data.name || !data.address || !data.postcode) {
        throw new ValidationError('Name, address, and postcode are required');
      }

      let clientId = data.clientId;

      // If clientId not provided, determine it based on user role
      if (!clientId) {
        if (userRole === 'client') {
          // Get user's client by email (same logic as booking service)
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, tenantId: true },
          });

          if (!user || !user.email) {
            throw new NotFoundError('User', userId);
          }

          // Find client by email within the tenant
          let client = await prisma.client.findFirst({
            where: {
              tenantId: user.tenantId,
              email: user.email,
            },
          });

          // If no client found, create one (same as booking service)
          if (!client) {
            client = await prisma.client.create({
              data: {
                tenantId: user.tenantId,
                name: user.email.split('@')[0], // Use email prefix as name
                email: user.email,
                status: 'active',
              },
            });
          }

          clientId = client.id;
        } else if (userRole === 'admin' || userRole === 'reseller') {
          // For admin/reseller, clientId must be provided
          throw new ValidationError('clientId is required for admin/reseller users');
        }
      }

      // At this point, clientId should be defined
      if (!clientId) {
        throw new ValidationError('clientId is required');
      }

      // Verify client exists and belongs to tenant
      const client = await prisma.client.findUnique({
        where: { id: clientId },
      });

      if (!client) {
        throw new NotFoundError('Client', clientId);
      }

      if (client.tenantId !== tenantId) {
        throw new ValidationError('Client does not belong to this tenant');
      }

      // Create site
      const site = await prisma.site.create({
        data: {
          clientId,
          tenantId,
          name: data.name,
          address: data.address,
          postcode: data.postcode,
          lat: data.lat,
          lng: data.lng,
          contactName: data.contactName,
          contactPhone: data.contactPhone,
        },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              organisationName: true,
            },
          },
        },
      });

      logger.info('Site created', { siteId: site.id, clientId, tenantId });

      return site;
    } catch (error) {
      logger.error('Error creating site', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Update a site
   */
  async updateSite(siteId: string, data: UpdateSiteData, userId: string, tenantId: string, userRole: string) {
    try {
      // Verify site exists and user has access (getSiteById throws if not found/unauthorized)
      await this.getSiteById(siteId, userId, tenantId, userRole);

      // Update site
      const site = await prisma.site.update({
        where: { id: siteId },
        data: {
          name: data.name,
          address: data.address,
          postcode: data.postcode,
          lat: data.lat,
          lng: data.lng,
          contactName: data.contactName,
          contactPhone: data.contactPhone,
        },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              organisationName: true,
            },
          },
        },
      });

      logger.info('Site updated', { siteId, tenantId });

      return site;
    } catch (error) {
      logger.error('Error updating site', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Delete a site
   */
  async deleteSite(siteId: string, userId: string, tenantId: string, userRole: string) {
    try {
      // Verify site exists and user has access
      await this.getSiteById(siteId, userId, tenantId, userRole);

      // Check if site has any bookings
      const bookingsCount = await prisma.booking.count({
        where: { siteId },
      });

      if (bookingsCount > 0) {
        throw new ValidationError('Cannot delete site with existing bookings');
      }

      // Delete site
      await prisma.site.delete({
        where: { id: siteId },
      });

      logger.info('Site deleted', { siteId, tenantId });

      return { success: true };
    } catch (error) {
      logger.error('Error deleting site', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }
}
