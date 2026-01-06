-- CreateTable
CREATE TABLE "OrganisationProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organisationName" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganisationProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganisationProfile_userId_key" ON "OrganisationProfile"("userId");

-- CreateIndex
CREATE INDEX "OrganisationProfile_userId_idx" ON "OrganisationProfile"("userId");

-- AddForeignKey
ALTER TABLE "OrganisationProfile" ADD CONSTRAINT "OrganisationProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

