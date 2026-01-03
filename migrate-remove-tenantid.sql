-- SQL Migration to remove tenantId from AssetCategory
-- Run this after running migrate-to-global-categories.ts

-- Step 1: Remove the foreign key constraint
ALTER TABLE "AssetCategory" DROP CONSTRAINT IF EXISTS "AssetCategory_tenantId_fkey";

-- Step 2: Remove the index
DROP INDEX IF EXISTS "AssetCategory_tenantId_idx";

-- Step 3: Remove the tenantId column
ALTER TABLE "AssetCategory" DROP COLUMN IF EXISTS "tenantId";

-- Step 4: Add unique constraint on name (if not already exists)
-- Note: This might fail if there are duplicates - run migrate-to-global-categories.ts first
ALTER TABLE "AssetCategory" ADD CONSTRAINT "AssetCategory_name_key" UNIQUE ("name");

