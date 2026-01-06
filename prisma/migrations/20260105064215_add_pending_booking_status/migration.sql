-- AlterEnum
-- Add the enum value 'pending' to BookingStatus
-- Note: This migration was applied manually in two separate transactions
-- to avoid PostgreSQL's restriction on using new enum values in the same transaction
-- Step 1: Add enum value
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'pending';

-- AlterTable
-- Update the default value to 'pending' (applied in separate transaction)
ALTER TABLE "Booking" ALTER COLUMN "status" SET DEFAULT 'pending';

