// Workflow state machine validation

import { BookingStatus, JobStatus } from '../types';

/**
 * Booking status transitions (matching frontend logic)
 */
export const bookingTransitions: Record<BookingStatus, BookingStatus[]> = {
  created: ['scheduled', 'cancelled'],
  scheduled: ['collected', 'cancelled'],
  collected: ['sanitised'],
  sanitised: ['graded'],
  graded: ['completed'],
  completed: [],
  cancelled: [],
};

/**
 * Job status transitions (matching frontend logic)
 */
export const jobTransitions: Record<JobStatus, JobStatus[]> = {
  booked: ['routed', 'en_route'],
  routed: ['en_route'],
  en_route: ['arrived'],
  arrived: ['collected'],
  collected: ['warehouse', 'completed'], // Drivers can mark as completed, or move to warehouse
  warehouse: ['sanitised'], // Only admins can move from warehouse to sanitised (driver's role ends at warehouse)
  sanitised: ['graded'],
  graded: ['completed'],
  completed: [],
  cancelled: [],
};

/**
 * Check if booking status transition is valid
 */
export function isValidBookingTransition(
  from: BookingStatus,
  to: BookingStatus
): boolean {
  if (from === to) return true; // No-op transition
  const allowed = bookingTransitions[from] || [];
  return allowed.includes(to);
}

/**
 * Check if job status transition is valid
 */
export function isValidJobTransition(
  from: JobStatus,
  to: JobStatus
): boolean {
  if (from === to) return true; // No-op transition
  const allowed = jobTransitions[from] || [];
  return allowed.includes(to);
}

/**
 * Get next valid statuses for booking
 */
export function getNextValidBookingStatuses(
  current: BookingStatus
): BookingStatus[] {
  return bookingTransitions[current] || [];
}

/**
 * Get next valid statuses for job
 */
export function getNextValidJobStatuses(
  current: JobStatus
): JobStatus[] {
  return jobTransitions[current] || [];
}

