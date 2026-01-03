-- Migration: Make Evidence.uploadedBy nullable to preserve evidence when drivers are deleted
-- This allows evidence to be preserved for audit purposes even after driver account deletion

-- Step 1: Drop the existing foreign key constraint
ALTER TABLE "Evidence" DROP CONSTRAINT IF EXISTS "Evidence_uploadedBy_fkey";

-- Step 2: Alter the column to allow NULL values
ALTER TABLE "Evidence" ALTER COLUMN "uploadedBy" DROP NOT NULL;

-- Step 3: Recreate the foreign key constraint with ON DELETE SET NULL
ALTER TABLE "Evidence" 
ADD CONSTRAINT "Evidence_uploadedBy_fkey" 
FOREIGN KEY ("uploadedBy") 
REFERENCES "User"("id") 
ON DELETE SET NULL 
ON UPDATE CASCADE;

-- Step 4: Add index on uploadedBy if it doesn't exist
CREATE INDEX IF NOT EXISTS "Evidence_uploadedBy_idx" ON "Evidence"("uploadedBy");

