// Transform database job format to API response format
// Maps Prisma job model to frontend-expected format

import { JobStatus } from '../types';

export interface TransformedJob {
  id: string;
  erpJobNumber: string;
  bookingId?: string | null;
  clientName: string;
  organisationName?: string; // Organisation/company name
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
    eta?: string;
  } | null;
  co2eSaved: number;
  travelEmissions: number;
  buybackValue: number;
  charityPercent: number;
  roundTripDistanceKm?: number | null; // From booking
  roundTripDistanceMiles?: number | null; // From booking
  // Driver journey fields (entered before starting journey in routed status)
  dial2Collection?: string | null;
  securityRequirements?: string | null;
  idRequired?: string | null;
  loadingBayLocation?: string | null;
  vehicleHeightRestrictions?: string | null;
  doorLiftSize?: string | null;
  roadWorksPublicEvents?: string | null;
  manualHandlingRequirements?: string | null;
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
    organisationName: job.booking?.client?.organisationName || job.booking?.clientName || undefined,
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
    driver: job.driver ? (() => {
      const driverData = {
        id: job.driver.id,
        name: job.driver.name,
        vehicleReg: job.driver.driverProfile?.vehicleReg ?? 'N/A',
        vehicleType: (job.driver.driverProfile?.vehicleType ?? 'van') as 'van' | 'truck' | 'car',
        vehicleFuelType: (job.driver.driverProfile?.vehicleFuelType ?? 'diesel') as 'petrol' | 'diesel' | 'electric',
        phone: job.driver.driverProfile?.phone ?? job.driver.phone ?? job.driver.email ?? 'N/A',
      };

      let eta: string | undefined;
      const scheduledDate = job.scheduledDate instanceof Date ? job.scheduledDate : new Date(job.scheduledDate);
      const now = new Date();
      
      if (job.status === 'routed') {
        // Driver hasn't started traveling yet - no ETA available
        eta = undefined; // Will display as "--:--" on frontend
      } else if (job.status === 'en_route') {
        // Driver is currently traveling
        if (scheduledDate > now) {
          // Scheduled time hasn't passed - show scheduled arrival time
          eta = scheduledDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        } else {
          // Scheduled time has passed - calculate from current time + travel time
          const roundTripDistanceKm = job.booking?.roundTripDistanceKm ?? null;
          const oneWayDistanceKm = roundTripDistanceKm ? roundTripDistanceKm / 2 : null;
          
          if (oneWayDistanceKm && oneWayDistanceKm > 0) {
            const averageSpeedKmh = 40;
            const travelTimeMinutes = (oneWayDistanceKm / averageSpeedKmh) * 60;
            const estimatedArrival = new Date(now.getTime() + travelTimeMinutes * 60 * 1000);
            eta = estimatedArrival.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
          } else {
            // No distance available, show scheduled time
            eta = scheduledDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
          }
        }
      }

      return {
        ...driverData,
        ...(eta ? { eta } : {}),
      };
    })() : null,
    co2eSaved: job.co2eSaved || 0,
    travelEmissions: job.travelEmissions || 0,
    buybackValue: job.buybackValue || 0,
    charityPercent: job.charityPercent || 0,
    roundTripDistanceKm: job.booking?.roundTripDistanceKm ?? null,
    roundTripDistanceMiles: job.booking?.roundTripDistanceMiles ?? null,
    dial2Collection: job.dial2Collection ?? null,
    securityRequirements: job.securityRequirements ?? null,
    idRequired: job.idRequired ?? null,
    loadingBayLocation: job.loadingBayLocation ?? null,
    vehicleHeightRestrictions: job.vehicleHeightRestrictions ?? null,
    doorLiftSize: job.doorLiftSize ?? null,
    roadWorksPublicEvents: job.roadWorksPublicEvents ?? null,
    manualHandlingRequirements: job.manualHandlingRequirements ?? null,
    evidence: (() => {
      // Check if evidence exists and is an array
      if (!job.evidence) {
        return null;
      }
      
      if (!Array.isArray(job.evidence)) {
        // If evidence is a single object (shouldn't happen but handle it), convert to array
        if (job.evidence && typeof job.evidence === 'object') {
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
        return []; // Return empty array instead of null if evidence array exists but is empty
      }
      
      // Process each evidence record - don't filter out records, just clean the data
      return job.evidence.map((ev: any) => {
        // Ensure photos is always an array, filter out empty strings
        const photos = Array.isArray(ev.photos) 
          ? ev.photos.filter((p: any) => p && typeof p === 'string' && p.trim().length > 0)
          : [];
        
        // Ensure sealNumbers is always an array, filter out empty strings
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

