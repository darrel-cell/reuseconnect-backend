import prisma from '../config/database';

export class DriverRepository {
  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id, role: 'driver' },
      include: {
        driverProfile: true,
        tenant: true,
      },
    });
  }

  async findByTenant(tenantId: string) {
    return prisma.user.findMany({
      where: {
        tenantId,
        role: 'driver',
        // Include both active and pending drivers (pending = haven't accepted invitation yet)
      },
      include: {
        driverProfile: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async createProfile(userId: string, data: {
    vehicleReg: string;
    vehicleType: string;
    vehicleFuelType: string;
    phone?: string;
  }) {
    return prisma.driverProfile.upsert({
      where: { userId },
      update: data,
      create: {
        userId,
        ...data,
      },
    });
  }

  async updateProfile(userId: string, data: {
    vehicleReg?: string;
    vehicleType?: string;
    vehicleFuelType?: string;
    phone?: string;
  }) {
    return prisma.driverProfile.update({
      where: { userId },
      data,
    });
  }

  async deleteProfile(userId: string) {
    return prisma.driverProfile.delete({
      where: { userId },
    });
  }
}

