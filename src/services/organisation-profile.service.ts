// Organisation Profile Service

import prisma from '../config/database';
import { NotFoundError, ValidationError } from '../utils/errors';

export interface OrganisationProfileData {
  organisationName: string;
  registrationNumber: string;
  address: string;
  email: string;
  phone: string;
}

export class OrganisationProfileService {
  /**
   * Get organisation profile for a user (reseller or admin)
   */
  async getProfile(userId: string) {
    const profile = await prisma.organisationProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
      },
    });

    return profile;
  }

  /**
   * Create or update organisation profile
   */
  async upsertProfile(userId: string, data: OrganisationProfileData) {
    // Validate required fields
    if (!data.organisationName?.trim()) {
      throw new ValidationError('Organisation name is required');
    }
    if (!data.registrationNumber?.trim()) {
      throw new ValidationError('Registration number is required');
    }
    if (!data.address?.trim()) {
      throw new ValidationError('Address is required');
    }
    if (!data.email?.trim()) {
      throw new ValidationError('Email is required');
    }
    if (!data.phone?.trim()) {
      throw new ValidationError('Phone number is required');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email.trim())) {
      throw new ValidationError('Invalid email format');
    }

    // Verify user exists and is admin or reseller
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!user) {
      throw new NotFoundError('User', userId);
    }

    if (user.role !== 'admin' && user.role !== 'reseller') {
      throw new ValidationError('Organisation profile is only available for admin and reseller roles');
    }

    // Upsert profile
    const profile = await prisma.organisationProfile.upsert({
      where: { userId },
      create: {
        userId,
        organisationName: data.organisationName.trim(),
        registrationNumber: data.registrationNumber.trim(),
        address: data.address.trim(),
        email: data.email.trim(),
        phone: data.phone.trim(),
      },
      update: {
        organisationName: data.organisationName.trim(),
        registrationNumber: data.registrationNumber.trim(),
        address: data.address.trim(),
        email: data.email.trim(),
        phone: data.phone.trim(),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
      },
    });

    return profile;
  }

  /**
   * Check if profile is complete
   */
  async isProfileComplete(userId: string): Promise<boolean> {
    const profile = await prisma.organisationProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return false;
    }

    return !!(
      profile.organisationName?.trim() &&
      profile.registrationNumber?.trim() &&
      profile.address?.trim() &&
      profile.email?.trim() &&
      profile.phone?.trim()
    );
  }
}

