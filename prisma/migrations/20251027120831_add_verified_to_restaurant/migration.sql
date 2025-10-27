/*
  Warnings:

  - The `features` column on the `SubscriptionPlan` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "OTPPurpose" AS ENUM ('RESTAURANT_SIGNUP', 'VOUCHER_CHECKOUT');

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'VOUCHER';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "voucherCode" TEXT,
ADD COLUMN     "voucherId" TEXT;

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SubscriptionPlan" DROP COLUMN "features",
ADD COLUMN     "features" TEXT[];

-- AlterTable
ALTER TABLE "Voucher" ADD COLUMN     "usedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "OTP" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "otp" TEXT NOT NULL,
    "purpose" "OTPPurpose" NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OTP_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OTP_phone_idx" ON "OTP"("phone");

-- CreateIndex
CREATE INDEX "OTP_purpose_idx" ON "OTP"("purpose");

-- CreateIndex
CREATE INDEX "OTP_expiresAt_idx" ON "OTP"("expiresAt");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
