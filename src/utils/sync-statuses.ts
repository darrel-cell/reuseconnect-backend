// Utility to sync booking and job statuses for existing data
import prisma from '../config/database';
import { BookingStatus, JobStatus } from '../types';
import { isValidBookingTransition, isValidJobTransition } from '../middleware/workflow';

/**
 * Map job status to booking status
 */
function mapJobStatusToBookingStatus(jobStatus: JobStatus): BookingStatus | null {
  if (jobStatus === 'collected' || jobStatus === 'warehouse') {
    return 'collected';
  } else if (jobStatus === 'sanitised') {
    return 'sanitised';
  } else if (jobStatus === 'graded') {
    return 'graded';
  } else if (jobStatus === 'completed') {
    return 'completed';
  } else if (jobStatus === 'cancelled') {
    return 'cancelled';
  }
  return null;
}

/**
 * Map booking status to job status
 */
function mapBookingStatusToJobStatus(bookingStatus: BookingStatus, currentJobStatus: JobStatus): JobStatus | null {
  if (bookingStatus === 'scheduled') {
    return 'routed';
  } else if (bookingStatus === 'collected') {
    // If job is already at warehouse or beyond, keep it; otherwise set to collected
    if (['warehouse', 'sanitised', 'graded', 'completed'].includes(currentJobStatus)) {
      return null; // Don't update
    }
    return 'collected';
  } else if (bookingStatus === 'sanitised') {
    return 'sanitised';
  } else if (bookingStatus === 'graded') {
    return 'graded';
  } else if (bookingStatus === 'completed') {
    return 'completed';
  } else if (bookingStatus === 'cancelled') {
    return 'cancelled';
  }
  return null;
}

/**
 * Sync all booking and job statuses
 */
export async function syncAllStatuses() {
  console.log('Starting status sync...');
  
  // Get all jobs with their bookings
  const jobs = await prisma.job.findMany({
    where: {
      bookingId: { not: null },
    },
    include: {
      booking: true,
    },
  });

  let syncedCount = 0;
  let skippedCount = 0;

  for (const job of jobs) {
    if (!job.booking) continue;

    const booking = job.booking;
    let updated = false;

    // Sync booking status from job status
    const targetBookingStatus = mapJobStatusToBookingStatus(job.status);
    if (targetBookingStatus && booking.status !== targetBookingStatus) {
      if (isValidBookingTransition(booking.status, targetBookingStatus)) {
        const updateData: any = { status: targetBookingStatus };
        
        // Set appropriate timestamps
        if (targetBookingStatus === 'collected' && !booking.collectedAt) {
          updateData.collectedAt = new Date();
        } else if (targetBookingStatus === 'sanitised' && !booking.sanitisedAt) {
          updateData.sanitisedAt = new Date();
        } else if (targetBookingStatus === 'graded' && !booking.gradedAt) {
          updateData.gradedAt = new Date();
        } else if (targetBookingStatus === 'completed' && !booking.completedAt) {
          updateData.completedAt = new Date();
        }

        await prisma.booking.update({
          where: { id: booking.id },
          data: updateData,
        });

        await prisma.bookingStatusHistory.create({
          data: {
            bookingId: booking.id,
            status: targetBookingStatus,
            changedBy: 'system',
            notes: `Synced from job status: ${job.status}`,
          },
        });

        updated = true;
        syncedCount++;
        console.log(`Synced booking ${booking.bookingNumber}: ${booking.status} -> ${targetBookingStatus} (from job ${job.erpJobNumber}: ${job.status})`);
      } else {
        skippedCount++;
        console.log(`Skipped booking ${booking.bookingNumber}: Invalid transition from ${booking.status} to ${targetBookingStatus}`);
      }
    }

    // Sync job status from booking status (only if booking was not just updated)
    if (!updated) {
      const targetJobStatus = mapBookingStatusToJobStatus(booking.status, job.status);
      if (targetJobStatus && job.status !== targetJobStatus) {
        if (isValidJobTransition(job.status, targetJobStatus)) {
          const updateData: any = { status: targetJobStatus };
          
          if (targetJobStatus === 'completed' && !job.completedDate) {
            updateData.completedDate = new Date();
          }

          await prisma.job.update({
            where: { id: job.id },
            data: updateData,
          });

          await prisma.jobStatusHistory.create({
            data: {
              jobId: job.id,
              status: targetJobStatus,
              changedBy: 'system',
              notes: `Synced from booking status: ${booking.status}`,
            },
          });

          syncedCount++;
          console.log(`Synced job ${job.erpJobNumber}: ${job.status} -> ${targetJobStatus} (from booking ${booking.bookingNumber}: ${booking.status})`);
        } else {
          skippedCount++;
          console.log(`Skipped job ${job.erpJobNumber}: Invalid transition from ${job.status} to ${targetJobStatus}`);
        }
      }
    }
  }

  console.log(`Status sync completed. Synced: ${syncedCount}, Skipped: ${skippedCount}`);
  return { syncedCount, skippedCount };
}

