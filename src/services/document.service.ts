// Document Service - Handles document generation and storage
import { DocumentRepository } from '../repositories/document.repository';
import { generateChainOfCustodyPDF, prepareChainOfCustodyData } from '../utils/document-generator';
import { NotFoundError } from '../utils/errors';
import path from 'path';
import fs from 'fs';
import prisma from '../config/database';

const documentRepo = new DocumentRepository();

export class DocumentService {
  /**
   * Generate and save Chain of Custody document for a job
   * This is called automatically when job status changes to 'warehouse' (after assets delivered to warehouse)
   */
  async generateChainOfCustody(jobId: string, generatedBy: string): Promise<string> {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        booking: {
          include: {
            client: true,
            site: true,
          },
        },
        assets: {
          include: {
            category: true,
          },
        },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
        driver: {
          include: {
            driverProfile: true,
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundError('Job', jobId);
    }

    if (!job.booking) {
      throw new NotFoundError('Booking', 'associated with job');
    }

    // Check if document already exists for this job
    // Use a transaction to prevent race conditions when status changes from 'collected' to 'warehouse'
    const existingDocs = await documentRepo.findByJobId(jobId);
    const existingChainOfCustody = existingDocs.find(doc => doc.type === 'chain-of-custody');
    
    // If document already exists, don't regenerate (only generate once)
    // Generate when status becomes 'collected' or 'warehouse' for the first time
    if (existingChainOfCustody) {
      const { logger } = await import('../utils/logger');
      logger.debug('Chain of Custody document already exists, skipping generation', { jobId });
      return existingChainOfCustody.id;
    }

    // Prepare data for document generation
    // Log journey fields for debugging
    const { logger } = await import('../utils/logger');
    logger.debug('Job journey fields before PDF generation', {
      jobId: job.id,
      dial2Collection: job.dial2Collection,
      securityRequirements: job.securityRequirements,
      idRequired: job.idRequired,
      loadingBayLocation: job.loadingBayLocation,
      vehicleHeightRestrictions: job.vehicleHeightRestrictions,
      doorLiftSize: job.doorLiftSize,
      roadWorksPublicEvents: job.roadWorksPublicEvents,
      manualHandlingRequirements: job.manualHandlingRequirements,
    });
    
    const chainOfCustodyData = await prepareChainOfCustodyData(job);

    // Generate PDF
    const documentsDir = path.join(process.cwd(), 'uploads', 'documents');
    if (!fs.existsSync(documentsDir)) {
      fs.mkdirSync(documentsDir, { recursive: true });
    }

    const fileName = `chain-of-custody-${job.erpJobNumber || jobId}-${Date.now()}.pdf`;
    const filePath = path.join(documentsDir, fileName);
    
    await generateChainOfCustodyPDF(chainOfCustodyData, filePath);

    // Get file size
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;

    // If file is empty, remove it and throw to allow retry/logging without saving a bad record
    if (fileSize === 0) {
      try {
        fs.unlinkSync(filePath);
      } catch (_) {
        // ignore cleanup failure
      }
      throw new Error('Generated Chain of Custody PDF is empty. Generation aborted.');
    }

    // Save document record to database
    const document = await documentRepo.create({
      tenantId: job.tenantId,
      jobId: job.id,
      bookingId: job.bookingId || undefined,
      name: `Chain of Custody - ${job.erpJobNumber || jobId}`,
      type: 'chain-of-custody',
      filePath: `/uploads/documents/${fileName}`, // Relative path for serving
      fileSize,
      mimeType: 'application/pdf',
      uploadedBy: generatedBy,
      metadata: JSON.stringify({
        erpJobNumber: job.erpJobNumber,
        bookingNumber: job.booking?.bookingNumber,
        collectionDate: chainOfCustodyData.collectionDate.toISOString(),
        driverName: chainOfCustodyData.driverName,
      }),
    });

    return document.id;
  }

  /**
   * Get document file path for serving
   */
  async getDocumentPath(documentId: string): Promise<string | null> {
    const document = await documentRepo.findById(documentId);
    if (!document) {
      return null;
    }

    // Return absolute path for file system access
    return path.join(process.cwd(), document.filePath);
  }

  /**
   * Get all documents for a job
   */
  async getJobDocuments(jobId: string) {
    return documentRepo.findByJobId(jobId);
  }

  /**
   * Get all documents for a booking
   */
  async getBookingDocuments(bookingId: string) {
    return documentRepo.findByBookingId(bookingId);
  }
}

