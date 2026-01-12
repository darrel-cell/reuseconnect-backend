-- AlterTable
-- Add buyback calculation fields to AssetCategory
ALTER TABLE "AssetCategory" ADD COLUMN "avgRRP" DOUBLE PRECISION,
ADD COLUMN "residualLow" DOUBLE PRECISION,
ADD COLUMN "buybackFloor" DOUBLE PRECISION,
ADD COLUMN "buybackCap" DOUBLE PRECISION;

-- CreateTable
-- Create BuybackConfig table for global buyback calculation settings
CREATE TABLE "BuybackConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "volumeFactor10" DOUBLE PRECISION NOT NULL DEFAULT 1.03,
    "volumeFactor50" DOUBLE PRECISION NOT NULL DEFAULT 1.06,
    "volumeFactor200" DOUBLE PRECISION NOT NULL DEFAULT 1.10,
    "ageFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "conditionFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "marketFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuybackConfig_pkey" PRIMARY KEY ("id")
);

-- Insert default BuybackConfig
INSERT INTO "BuybackConfig" ("id", "volumeFactor10", "volumeFactor50", "volumeFactor200", "ageFactor", "conditionFactor", "marketFactor", "updatedAt")
VALUES ('singleton', 1.03, 1.06, 1.10, 1.0, 1.0, 1.0, NOW());
