CREATE TABLE IF NOT EXISTS "KycConsent" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "restaurantName" TEXT NOT NULL,
  "tinNumber" TEXT NOT NULL,
  "phoneNumber" TEXT NOT NULL,
  "businessAddress" TEXT NOT NULL,
  "district" TEXT NOT NULL,
  "sector" TEXT,
  "ownerName" TEXT NOT NULL,
  "ownerNationalId" TEXT NOT NULL,
  "businessType" TEXT NOT NULL,
  "yearsInOperation" INTEGER NOT NULL,
  "consentVubaBuba" BOOLEAN NOT NULL DEFAULT false,
  "consentKayko" BOOLEAN NOT NULL DEFAULT false,
  "consentRRA" BOOLEAN NOT NULL DEFAULT false,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KycConsent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "KycConsent_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "KycConsent_restaurantId_key" ON "KycConsent"("restaurantId");
CREATE INDEX IF NOT EXISTS "KycConsent_restaurantId_idx" ON "KycConsent"("restaurantId");
