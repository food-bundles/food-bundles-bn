-- Additions that exist in the shared dev database (introspected with `prisma db pull`) but were never migrations:
-- KycConsent review fields, AppSetting, WishlistItem, extra notification/OTP enum values. All additive.
-- Databases that already have these (e.g. the shared dev DB) should mark it applied instead of running it:
--   prisma migrate resolve --applied 20261019150000_sync_remote_additions

-- CreateEnum
CREATE TYPE "KycConsentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "NotificationCategory" ADD VALUE 'PRIVATE_RECEIVER';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationEvent" ADD VALUE 'SUBMISSION_FORCE_COMPLETED';
ALTER TYPE "NotificationEvent" ADD VALUE 'VOUCHER_PENALTY_APPLIED';
ALTER TYPE "NotificationEvent" ADD VALUE 'VOUCHER_SUSPENDED';
ALTER TYPE "NotificationEvent" ADD VALUE 'SUBSCRIPTION_ACTIVATED';
ALTER TYPE "NotificationEvent" ADD VALUE 'KYC_SUBMITTED';
ALTER TYPE "NotificationEvent" ADD VALUE 'KYC_APPROVED';
ALTER TYPE "NotificationEvent" ADD VALUE 'KYC_REJECTED';
ALTER TYPE "NotificationEvent" ADD VALUE 'WALLET_TRANSACTION';
ALTER TYPE "NotificationEvent" ADD VALUE 'ADMIN_ROLE_CHANGED';
ALTER TYPE "NotificationEvent" ADD VALUE 'ORDER_CANCELLED';
ALTER TYPE "NotificationEvent" ADD VALUE 'VOUCHER_MATURING_SOON';
ALTER TYPE "NotificationEvent" ADD VALUE 'SUBMISSION_CREATED';
ALTER TYPE "NotificationEvent" ADD VALUE 'SUBMISSION_REJECTED';
ALTER TYPE "NotificationEvent" ADD VALUE 'SUBMISSION_STATUS_REVERSED';
ALTER TYPE "NotificationEvent" ADD VALUE 'SUBMISSION_PAYOUT_FAILED';

-- AlterEnum
ALTER TYPE "OTPPurpose" ADD VALUE 'SUBMISSION_PAYOUT';

-- AlterTable
ALTER TABLE "KycConsent" ADD COLUMN     "reviewNotes" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedBy" TEXT,
ADD COLUMN     "status" "KycConsentStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "NotificationRecipient" ADD COLUMN     "email" TEXT;

-- AlterTable
ALTER TABLE "Voucher" ADD COLUMN     "maturingSoonNotified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "WishlistItem" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WishlistItem_restaurantId_idx" ON "WishlistItem"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "WishlistItem_restaurantId_productId_key" ON "WishlistItem"("restaurantId", "productId");

-- CreateIndex
CREATE INDEX "KycConsent_status_idx" ON "KycConsent"("status");

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

