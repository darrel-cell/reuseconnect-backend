-- AlterTable
-- Allow site deletion by setting siteId to NULL in bookings when site is deleted
-- First, drop the existing foreign key constraint
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "Booking_siteId_fkey";

-- Recreate the foreign key constraint with ON DELETE SET NULL
ALTER TABLE "Booking" 
ADD CONSTRAINT "Booking_siteId_fkey" 
FOREIGN KEY ("siteId") 
REFERENCES "Site"("id") 
ON DELETE SET NULL 
ON UPDATE CASCADE;
