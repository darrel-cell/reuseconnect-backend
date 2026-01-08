-- Add performance indexes for better query performance
-- Composite indexes for common query patterns

-- Job indexes
CREATE INDEX IF NOT EXISTS "Job_status_scheduledDate_idx" ON "Job"("status", "scheduledDate");
CREATE INDEX IF NOT EXISTS "Job_driverId_status_idx" ON "Job"("driverId", "status");
CREATE INDEX IF NOT EXISTS "Job_tenantId_createdAt_idx" ON "Job"("tenantId", "createdAt");

-- Booking indexes
CREATE INDEX IF NOT EXISTS "Booking_clientId_status_idx" ON "Booking"("clientId", "status");
CREATE INDEX IF NOT EXISTS "Booking_tenantId_scheduledDate_idx" ON "Booking"("tenantId", "scheduledDate");
CREATE INDEX IF NOT EXISTS "Booking_status_scheduledDate_idx" ON "Booking"("status", "scheduledDate");

