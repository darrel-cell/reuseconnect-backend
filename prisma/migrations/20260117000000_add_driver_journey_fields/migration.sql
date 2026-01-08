-- AlterTable
-- Add driver journey fields to Job model
-- These fields are entered by the driver before starting the journey (in routed status)
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "dial2Collection" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "securityRequirements" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "idRequired" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "loadingBayLocation" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "vehicleHeightRestrictions" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "doorLiftSize" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "roadWorksPublicEvents" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "manualHandlingRequirements" TEXT;


