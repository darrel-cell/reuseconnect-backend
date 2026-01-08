// Document Repository
import prisma from '../config/database';

export class DocumentRepository {
  async create(data: {
    tenantId: string;
    jobId?: string;
    bookingId?: string;
    name: string;
    type: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
    uploadedBy: string;
    metadata?: string;
  }) {
    return prisma.document.create({
      data,
    });
  }

  async findByJobId(jobId: string) {
    return prisma.document.findMany({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByBookingId(bookingId: string) {
    return prisma.document.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    return prisma.document.findUnique({
      where: { id },
    });
  }

  async delete(id: string) {
    return prisma.document.delete({
      where: { id },
    });
  }
}

