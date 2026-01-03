import prisma from '../config/database';

export class TenantRepository {
  async findById(id: string) {
    return prisma.tenant.findUnique({
      where: { id },
    });
  }

  async findBySlug(slug: string) {
    return prisma.tenant.findUnique({
      where: { slug },
    });
  }

  async create(data: {
    name: string;
    slug: string;
    logo?: string;
    favicon?: string;
    primaryColor?: string;
    accentColor?: string;
    theme?: string;
  }) {
    return prisma.tenant.create({
      data,
    });
  }

  async update(id: string, data: {
    name?: string;
    logo?: string;
    favicon?: string;
    primaryColor?: string;
    accentColor?: string;
    theme?: string;
  }) {
    return prisma.tenant.update({
      where: { id },
      data,
    });
  }
}

