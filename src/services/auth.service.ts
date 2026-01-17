import { UserRepository } from '../repositories/user.repository';
import { TenantRepository } from '../repositories/tenant.repository';
import { hashPassword, comparePassword } from '../utils/password';
import { generateToken } from '../utils/jwt';
import { ValidationError, NotFoundError, UnauthorizedError } from '../utils/errors';
import { UserRole } from '../types';
import prisma from '../config/database';
// UUID generation not needed for Prisma (auto-generated)

const userRepo = new UserRepository();
const tenantRepo = new TenantRepository();

export class AuthService {
  async login(email: string, password: string) {
    const user = await userRepo.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isValid = await comparePassword(password, user.password);
    if (!isValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedError('Account is not active. Please contact support.');
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role as UserRole,
      tenantId: user.tenantId,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        tenantId: user.tenantId,
        tenantName: user.tenant.name,
        avatar: user.avatar,
        createdAt: user.createdAt.toISOString(),
      },
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        slug: user.tenant.slug,
        logo: user.tenant.logo,
        favicon: user.tenant.favicon,
        primaryColor: user.tenant.primaryColor,
        accentColor: user.tenant.accentColor,
        theme: user.tenant.theme,
        createdAt: user.tenant.createdAt.toISOString(),
      },
      token,
    };
  }

  async signup(data: {
    email: string;
    password: string;
    name: string;
    companyName: string;
    role?: 'client' | 'reseller';
  }) {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      throw new ValidationError('Invalid email format');
    }

    // Validate password strength
    if (data.password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long');
    }

    // Check if user already exists
    const existingUser = await userRepo.findByEmail(data.email);
    if (existingUser) {
      throw new ValidationError('An account with this email already exists');
    }

    // Drivers cannot sign up directly - they must be invited
    // @ts-expect-error - Runtime check for invalid role value
    if (data.role === 'driver') {
      throw new ValidationError('Drivers must be invited by an administrator. Please use the invitation link to join.');
    }

    // Generate slug from company name
    const slug = data.companyName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    // Check if slug already exists
    const existingTenant = await tenantRepo.findBySlug(slug);
    if (existingTenant) {
      throw new ValidationError('A company with this name already exists. Please use a different company name.');
    }

    // Create tenant
    const tenant = await tenantRepo.create({
      name: data.companyName,
      slug: slug,
      primaryColor: '168, 70%, 35%',
      accentColor: '168, 60%, 45%',
      theme: 'auto',
    });

    // Hash password
    const hashedPassword = await hashPassword(data.password);

    // Create user with pending status - requires admin approval
    // Users start as 'pending' and require admin approval in all environments
    const userStatus = 'pending';
    
    const userRole = (data.role || 'client') as UserRole;

    const user = await userRepo.create({
      email: data.email,
      name: data.name,
      password: hashedPassword,
      role: userRole,
      status: userStatus,
      tenantId: tenant.id,
    });

    // Notify all admin users about pending user approval
    try {
        // Get all admin users (admins are global across tenants)
        const adminUsers = await prisma.user.findMany({
          where: {
            role: 'admin',
            status: 'active',
          },
          select: { id: true },
        });

        if (adminUsers.length > 0) {
          const { notifyPendingUserApproval } = await import('../utils/notifications');
          const { logger } = await import('../utils/logger');
          
          logger.info('Notifying admins of pending user approval', {
            userId: user.id,
            email: user.email,
            role: userRole,
            adminCount: adminUsers.length,
          });

          // Notify all admins about pending user approval
          await notifyPendingUserApproval(
            user.id,
            user.email,
            user.name,
            userRole,
            adminUsers.map(a => a.id),
            tenant.id
          );
        }
    } catch (error) {
      // Log error but don't fail signup if notification fails
      const { logger } = await import('../utils/logger');
      logger.error('Failed to notify admins of pending user signup', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: user.id,
      });
    }

    // If role is 'client', create a Client record with the organisationName from companyName
    if (userRole === 'client') {
      await prisma.client.create({
        data: {
          tenantId: tenant.id,
          name: data.name,
          email: data.email,
          organisationName: data.companyName, // Save companyName as organisationName
          status: 'active',
        },
      });
    }

    // If role is 'reseller', create an OrganisationProfile with organisationName from companyName
    if (userRole === 'reseller') {
      await prisma.organisationProfile.create({
        data: {
          userId: user.id,
          organisationName: data.companyName,
          // These can be completed later in Settings → Organisation section
          registrationNumber: '',
          address: '',
          email: data.email,
          phone: '',
        },
      });
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role as UserRole,
      tenantId: user.tenantId,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        tenantId: user.tenantId,
        tenantName: tenant.name,
        avatar: user.avatar,
        createdAt: user.createdAt.toISOString(),
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        logo: tenant.logo,
        favicon: tenant.favicon,
        primaryColor: tenant.primaryColor,
        accentColor: tenant.accentColor,
        theme: tenant.theme,
        createdAt: tenant.createdAt.toISOString(),
      },
      token,
    };
  }

  async getCurrentUser(userId: string) {
    const user = await userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      tenantId: user.tenantId,
      tenantName: user.tenant.name,
      avatar: user.avatar,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
