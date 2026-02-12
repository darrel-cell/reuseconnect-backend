-- CreateTable
CREATE TABLE "TwoFactorCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TwoFactorCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TwoFactorCode_userId_idx" ON "TwoFactorCode"("userId");

-- CreateIndex
CREATE INDEX "TwoFactorCode_code_idx" ON "TwoFactorCode"("code");

-- CreateIndex
CREATE INDEX "TwoFactorCode_expiresAt_idx" ON "TwoFactorCode"("expiresAt");

-- CreateIndex
CREATE INDEX "TwoFactorCode_userId_used_idx" ON "TwoFactorCode"("userId", "used");

-- AddForeignKey
ALTER TABLE "TwoFactorCode" ADD CONSTRAINT "TwoFactorCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
