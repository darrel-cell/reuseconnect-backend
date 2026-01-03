-- Migration: Add status field to Evidence model and update unique constraint
-- This allows multiple evidence records per job (one per status)

-- Step 1: Add status column (nullable initially for existing records)
ALTER TABLE "Evidence" ADD COLUMN IF NOT EXISTS "status" "JobStatus";

-- Step 2: Update existing evidence records to use the job's current status
UPDATE "Evidence" e
SET "status" = j."status"
FROM "Job" j
WHERE e."jobId" = j."id" AND e."status" IS NULL;

-- Step 3: Make status NOT NULL (after updating existing records)
ALTER TABLE "Evidence" ALTER COLUMN "status" SET NOT NULL;

-- Step 4: Drop the old unique constraint on jobId
ALTER TABLE "Evidence" DROP CONSTRAINT IF EXISTS "Evidence_jobId_key";

-- Step 5: Add new unique constraint on (jobId, status)
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_jobId_status_key" UNIQUE ("jobId", "status");

-- Step 6: Add index on status for faster queries
CREATE INDEX IF NOT EXISTS "Evidence_status_idx" ON "Evidence"("status");

