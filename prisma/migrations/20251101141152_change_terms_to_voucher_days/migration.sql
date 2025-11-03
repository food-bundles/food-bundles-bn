/*
  Warnings:

  - You are about to drop the column `terms` on the `LoanApplication` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'PREPARING', 'READY', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "LoanStatus" ADD VALUE 'DISBURSED';

-- AlterTable
ALTER TABLE "LoanApplication" DROP COLUMN "terms",
ADD COLUMN     "voucherDays" INTEGER;

-- AlterTable
ALTER TABLE "SubscriptionPlan" ADD COLUMN     "advertisingAccess" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "freeDelivery" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "receiveEBM" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stablePricing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "voucherAccess" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "voucherPaymentDays" INTEGER NOT NULL DEFAULT 30;

-- CreateTable
CREATE TABLE "DeliveryOTP" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "otp" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryOTP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderDelivery" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "logisticsId" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "otpVerified" BOOLEAN NOT NULL DEFAULT false,
    "deliveryDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryOTP_orderId_key" ON "DeliveryOTP"("orderId");

-- CreateIndex
CREATE INDEX "DeliveryOTP_orderId_idx" ON "DeliveryOTP"("orderId");

-- CreateIndex
CREATE INDEX "DeliveryOTP_expiresAt_idx" ON "DeliveryOTP"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrderDelivery_orderId_key" ON "OrderDelivery"("orderId");

-- CreateIndex
CREATE INDEX "OrderDelivery_orderId_idx" ON "OrderDelivery"("orderId");

-- CreateIndex
CREATE INDEX "OrderDelivery_logisticsId_idx" ON "OrderDelivery"("logisticsId");

-- CreateIndex
CREATE INDEX "OrderDelivery_status_idx" ON "OrderDelivery"("status");

-- AddForeignKey
ALTER TABLE "DeliveryOTP" ADD CONSTRAINT "DeliveryOTP_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDelivery" ADD CONSTRAINT "OrderDelivery_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDelivery" ADD CONSTRAINT "OrderDelivery_logisticsId_fkey" FOREIGN KEY ("logisticsId") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
