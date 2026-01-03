import { UserRepository } from '../repositories/user.repository';
import { TenantRepository } from '../repositories/tenant.repository';
import { hashPassword, comparePassword } from '../utils/password';
import { generateToken } from '../utils/jwt';
import { ValidationError, NotFoundError, UnauthorizedError } from '../utils/errors';
import { UserRole } from '../types';
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
    // This check prevents any attempt to sign up as a driver
    if (data.role === 'driver') {
      throw new ValidationError('Drivers must be invited by an administrator. Please use the invitation link to join.');
    }

    // Create tenant
    const tenant = await tenantRepo.create({
      name: data.companyName,
      slug: data.companyName.toLowerCase().replace(/\s+/g, '-'),
      primaryColor: '168, 70%, 35%',
      accentColor: '168, 60%, 45%',
      theme: 'auto',
    });

    // Hash password
    const hashedPassword = await hashPassword(data.password);

    // Create user with pending status (or active in development)
    // In production, users start as 'pending' and require admin approval
    // In development, auto-activate for easier testing
    const userStatus = process.env.NODE_ENV === 'production' ? 'pending' : 'active';
    
    const user = await userRepo.create({
      email: data.email,
      name: data.name,
      password: hashedPassword,
      role: (data.role || 'client') as UserRole,
      status: userStatus,
      tenantId: tenant.id,
    });

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
