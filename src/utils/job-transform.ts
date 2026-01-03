// Transform database job format to API response format
// Maps Prisma job model to frontend-expected format

import { JobStatus } from '../types';

export interface TransformedJob {
  id: string;
  erpJobNumber: string;
  bookingId?: string | null;
  clientName: string;
  siteName: string;
  siteAddress: string;
  status: string; // Converted to frontend format (en-route instead of en_route)
  scheduledDate: string;
  completedDate?: string | null;
  assets: Array<{
    id: string;
    category: string; // categoryName
    quantity: number;
    serialNumbers?: string[];
    grade?: string | null;
    weight?: number | null;
    sanitised?: boolean;
    wipeMethod?: string | null;
    sanitisationRecordId?: string | null;
    gradingRecordId?: string | null;
    resaleValue?: number | null;
  }>;
  driver?: {
    id: string;
    name: string;
    vehicleReg: string;
    vehicleType: 'van' | 'truck' | 'car';
    vehicleFuelType?: 'petrol' | 'diesel' | 'electric';
    phone: string;
  } | null;
  co2eSaved: number;
  travelEmissions: number;
  buybackValue: number;
  charityPercent: number;
  evidence?: Array<{
    status: string; // Status for which this evidence was submitted
    photos: string[];
    signature?: string | null;
    sealNumbers: string[];
    notes?: string | null;
    createdAt: string;
  }> | null;
  certificates: Array<{
    type: string;
    generatedDate: string;
    downloadUrl: string;
  }>;
}

/**
 * Transform job status from backend format to frontend format
 */
function transformStatus(status: JobStatus): string {
  const statusMap: Record<JobStatus, string> = {
    'booked': 'booked',
    'routed': 'routed',
    'en_route': 'en-route',
    'arrived': 'arrived',
    'collected': 'collected',
    'warehouse': 'warehouse',
    'sanitised': 'sanitised',
    'graded': 'graded',
    'completed': 'completed',
    'cancelled': 'cancelled',
  };
  
  return statusMap[status] || status;
}

/**
 * Transform a Prisma job to API response format
 */
export function transformJobForAPI(job: any): TransformedJob {
  return {
    id: job.id,
    erpJobNumber: job.erpJobNumber,
    bookingId: job.bookingId,
    clientName: job.clientName,
    siteName: job.siteName,
    siteAddress: job.siteAddress,
    status: transformStatus(job.status),
    scheduledDate: job.scheduledDate instanceof Date 
      ? job.scheduledDate.toISOString() 
      : job.scheduledDate,
    completedDate: job.completedDate 
      ? (job.completedDate instanceof Date 
          ? job.completedDate.toISOString() 
          : job.completedDate)
      : null,
    assets: (job.assets || []).map((asset: any) => ({
      id: asset.id,
      category: asset.categoryName,
      categoryId: asset.categoryId, // Include categoryId for frontend matching
      categoryName: asset.categoryName, // Include categoryName for display
      quantity: asset.quantity,
      serialNumbers: asset.serialNumbers || [],
      grade: asset.grade,
      weight: asset.weight,
      sanitised: asset.sanitised || false,
      wipeMethod: asset.wipeMethod,
      sanitisationRecordId: asset.sanitisationRecordId,
      gradingRecordId: asset.gradingRecordId,
      resaleValue: asset.resaleValue,
    })),
    driver: job.driver ? {
      id: job.driver.id,
      name: job.driver.name,
      vehicleReg: job.driver.driverProfile?.vehicleReg ?? 'N/A',
      vehicleType: (job.driver.driverProfile?.vehicleType ?? 'van') as 'van' | 'truck' | 'car',
      vehicleFuelType: (job.driver.driverProfile?.vehicleFuelType ?? 'diesel') as 'petrol' | 'diesel' | 'electric',
      phone: job.driver.driverProfile?.phone ?? job.driver.phone ?? job.driver.email ?? 'N/A',
    } : null,
    co2eSaved: job.co2eSaved || 0,
    travelEmissions: job.travelEmissions || 0,
    buybackValue: job.buybackValue || 0,
    charityPercent: job.charityPercent || 0,
    evidence: (() => {
      // Debug: Log raw evidence data - ALWAYS log to help diagnose
      console.log('[Evidence Transform] Job ID:', job.id);
      console.log('[Evidence Transform] Raw evidence from DB:', {
        isArray: Array.isArray(job.evidence),
        length: Array.isArray(job.evidence) ? job.evidence.length : 'N/A',
        type: typeof job.evidence,
        value: job.evidence,
      });
      
      // Check if evidence exists and is an array
      if (!job.evidence) {
        console.log('[Evidence Transform] No evidence property on job');
        return null;
      }
      
      if (!Array.isArray(job.evidence)) {
        console.log('[Evidence Transform] Evidence is not an array:', typeof job.evidence);
        console.log('[Evidence Transform] Evidence value:', job.evidence);
        // If evidence is a single object (shouldn't happen but handle it), convert to array
        if (job.evidence && typeof job.evidence === 'object') {
          console.log('[Evidence Transform] Converting single evidence object to array');
          return [job.evidence].map((ev: any) => {
            const photos = Array.isArray(ev.photos) 
              ? ev.photos.filter((p: any) => p && typeof p === 'string' && p.trim().length > 0)
              : [];
            const sealNumbers = Array.isArray(ev.sealNumbers)
              ? ev.sealNumbers.filter((s: any) => s && typeof s === 'string' && s.trim().length > 0)
              : [];
            return {
              status: transformStatus(ev.status),
              photos: photos,
              signature: (ev.signature && typeof ev.signature === 'string' && ev.signature.trim().length > 0) ? ev.signature : null,
              sealNumbers: sealNumbers,
              notes: (ev.notes && typeof ev.notes === 'string' && ev.notes.trim().length > 0) ? ev.notes : null,
              createdAt: ev.createdAt instanceof Date ? ev.createdAt.toISOString() : ev.createdAt,
            };
          });
        }
        return null;
      }
      
      if (job.evidence.length === 0) {
        console.log('[Evidence Transform] Evidence array is empty');
        return []; // Return empty array instead of null if evidence array exists but is empty
      }
      
      console.log('[Evidence Transform] Processing', job.evidence.length, 'evidence records');
      
      // Process each evidence record - don't filter out records, just clean the data
      return job.evidence.map((ev: any, index: number) => {
        console.log(`[Evidence Transform] Processing evidence ${index + 1}:`, {
          id: ev.id,
          status: ev.status,
          photosCount: Array.isArray(ev.photos) ? ev.photos.length : 0,
          hasSignature: !!ev.signature,
          sealNumbersCount: Array.isArray(ev.sealNumbers) ? ev.sealNumbers.length : 0,
          hasNotes: !!ev.notes,
          raw: ev,
        });
        
        // Ensure photos is always an array, filter out empty strings
        const photos = Array.isArray(ev.photos) 
          ? ev.photos.filter((p: any) => p && typeof p === 'string' && p.trim().length > 0)
          : [];
        
        // Ensure sealNumbers is always an array, filter out empty strings
        const sealNumbers = Array.isArray(ev.sealNumbers)
          ? ev.sealNumbers.filter((s: any) => s && typeof s === 'string' && s.trim().length > 0)
          : [];
        
        const transformed = {
          status: transformStatus(ev.status),
          photos: photos,
          signature: (ev.signature && typeof ev.signature === 'string' && ev.signature.trim().length > 0) ? ev.signature : null,
          sealNumbers: sealNumbers,
          notes: (ev.notes && typeof ev.notes === 'string' && ev.notes.trim().length > 0) ? ev.notes : null,
          createdAt: ev.createdAt instanceof Date ? ev.createdAt.toISOString() : ev.createdAt,
        };
        
        console.log(`[Evidence Transform] Transformed evidence ${index + 1}:`, transformed);
        
        return transformed;
      });
    })(),
    certificates: (job.certificates || []).map((cert: any) => ({
      type: cert.type.replace(/_/g, '-'), // chain_of_custody -> chain-of-custody
      generatedDate: cert.generatedDate instanceof Date
        ? cert.generatedDate.toISOString()
        : cert.generatedDate,
      downloadUrl: cert.downloadUrl,
    })),
  };
}

/**
 * Transform array of jobs
 */
export function transformJobsForAPI(jobs: any[]): TransformedJob[] {
  return jobs.map(transformJobForAPI);
}

