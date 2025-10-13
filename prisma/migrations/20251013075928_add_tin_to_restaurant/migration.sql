/*
  Warnings:

  - You are about to drop the column `checkoutId` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `deliveryCell` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `deliveryDistrict` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `deliveryLocation` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `deliveryProvince` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `deliverySector` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `deliveryVillage` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the `CHECKOUT` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[txRef]` on the table `Order` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tin]` on the table `Restaurant` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `Admin` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Farmer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `FarmerSubmission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `productName` to the `OrderItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subtotal` to the `OrderItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `unit` to the `OrderItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `OrderItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `POSSale` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tin` to the `Restaurant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Restaurant` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('TOP_UP', 'PAYMENT', 'REFUND', 'ADJUSTMENT', 'WITHDRAWAL');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED', 'SUSPENDED', 'PENDING');

-- CreateEnum
CREATE TYPE "SubscriptionAction" AS ENUM ('CREATED', 'RENEWED', 'UPGRADED', 'DOWNGRADED', 'CANCELLED', 'SUSPENDED', 'REACTIVATED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "VoucherType" AS ENUM ('DISCOUNT_10', 'DISCOUNT_20', 'DISCOUNT_50', 'DISCOUNT_80', 'DISCOUNT_100');

-- CreateEnum
CREATE TYPE "VoucherStatus" AS ENUM ('ACTIVE', 'USED', 'EXPIRED', 'SUSPENDED', 'SETTLED');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('PENDING', 'APPROVED', 'DISBURSED', 'REJECTED', 'SETTLED');

-- CreateEnum
CREATE TYPE "PenaltyStatus" AS ENUM ('PENDING', 'PAID', 'WAIVED');

-- DropForeignKey
ALTER TABLE "public"."CHECKOUT" DROP CONSTRAINT "CHECKOUT_cartId_fkey";

-- DropForeignKey
ALTER TABLE "public"."CHECKOUT" DROP CONSTRAINT "CHECKOUT_orderId_fkey";

-- DropForeignKey
ALTER TABLE "public"."CHECKOUT" DROP CONSTRAINT "CHECKOUT_restaurantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."OrderItem" DROP CONSTRAINT "OrderItem_orderId_fkey";

-- DropForeignKey
ALTER TABLE "public"."OrderItem" DROP CONSTRAINT "OrderItem_productId_fkey";

-- DropIndex
DROP INDEX "public"."Order_checkoutId_key";

-- AlterTable
ALTER TABLE "Admin" ADD COLUMN     "location" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "province" DROP NOT NULL,
ALTER COLUMN "district" DROP NOT NULL,
ALTER COLUMN "sector" DROP NOT NULL,
ALTER COLUMN "cell" DROP NOT NULL,
ALTER COLUMN "village" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Farmer" ADD COLUMN     "accountLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "locationUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "notificationFrequency" TEXT,
ADD COLUMN     "phoneChangedAt" TIMESTAMP(3),
ADD COLUMN     "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pinChangedAt" TIMESTAMP(3),
ADD COLUMN     "smsNotifications" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "province" DROP NOT NULL,
ALTER COLUMN "district" DROP NOT NULL,
ALTER COLUMN "sector" DROP NOT NULL,
ALTER COLUMN "cell" DROP NOT NULL,
ALTER COLUMN "village" DROP NOT NULL;

-- AlterTable
ALTER TABLE "FarmerSubmission" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "paymentMethod" "PaymentMethod",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "province" DROP NOT NULL,
ALTER COLUMN "district" DROP NOT NULL,
ALTER COLUMN "sector" DROP NOT NULL,
ALTER COLUMN "cell" DROP NOT NULL,
ALTER COLUMN "village" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "checkoutId",
DROP COLUMN "deliveryCell",
DROP COLUMN "deliveryDistrict",
DROP COLUMN "deliveryLocation",
DROP COLUMN "deliveryProvince",
DROP COLUMN "deliverySector",
DROP COLUMN "deliveryVillage",
ADD COLUMN     "appFee" DOUBLE PRECISION,
ADD COLUMN     "authorizationMode" TEXT,
ADD COLUMN     "billingAddress" TEXT,
ADD COLUMN     "billingEmail" TEXT,
ADD COLUMN     "billingName" TEXT,
ADD COLUMN     "billingPhone" TEXT,
ADD COLUMN     "cardCVV" TEXT,
ADD COLUMN     "cardExpiryMonth" TEXT,
ADD COLUMN     "cardExpiryYear" TEXT,
ADD COLUMN     "cardNumber" TEXT,
ADD COLUMN     "cardPIN" TEXT,
ADD COLUMN     "cardType" TEXT,
ADD COLUMN     "cartId" TEXT,
ADD COLUMN     "clientIp" TEXT,
ADD COLUMN     "currency" TEXT DEFAULT 'RWF',
ADD COLUMN     "deviceFingerprint" TEXT,
ADD COLUMN     "flwRef" TEXT,
ADD COLUMN     "flwStatus" TEXT,
ADD COLUMN     "merchantFee" DOUBLE PRECISION,
ADD COLUMN     "narration" TEXT,
ADD COLUMN     "network" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paymentProvider" TEXT DEFAULT 'FLUTTERWAVE',
ADD COLUMN     "paymentType" TEXT,
ADD COLUMN     "redirectUrl" TEXT,
ADD COLUMN     "transactionId" TEXT,
ADD COLUMN     "transferAccount" TEXT,
ADD COLUMN     "transferAmount" DOUBLE PRECISION,
ADD COLUMN     "transferBank" TEXT,
ADD COLUMN     "transferNote" TEXT,
ADD COLUMN     "transferReference" TEXT,
ADD COLUMN     "txOrderId" TEXT,
ADD COLUMN     "txRef" TEXT,
ADD COLUMN     "voucher" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "category" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "images" TEXT[],
ADD COLUMN     "productName" TEXT NOT NULL,
ADD COLUMN     "subtotal" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "unit" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "productId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "POSSale" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "location" TEXT,
ADD COLUMN     "tin" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "province" DROP NOT NULL,
ALTER COLUMN "district" DROP NOT NULL,
ALTER COLUMN "sector" DROP NOT NULL,
ALTER COLUMN "cell" DROP NOT NULL,
ALTER COLUMN "village" DROP NOT NULL;

-- DropTable
DROP TABLE "public"."CHECKOUT";

-- CreateTable
CREATE TABLE "FarmerSecurityEvent" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "description" TEXT,
    "ipAddress" TEXT,
    "deviceInfo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FarmerSecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmerSecurityQuestion" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answerHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FarmerSecurityQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmerLoginAttempt" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "successful" BOOLEAN NOT NULL,
    "attemptTime" TIMESTAMP(3) NOT NULL,
    "deviceInfo" TEXT,

    CONSTRAINT "FarmerLoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmerSecurityAlert" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FarmerSecurityAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmerProfile" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "farmSize" DOUBLE PRECISION,
    "farmSizeUnit" TEXT,
    "experienceYears" INTEGER,
    "cooperativeMember" BOOLEAN,
    "cooperativeName" TEXT,
    "certifications" TEXT[],
    "farmingMethod" TEXT,
    "preferredPaymentMethod" TEXT,
    "minimumOrderQuantity" DOUBLE PRECISION,
    "deliveryPreference" TEXT,
    "maxDeliveryDistance" DOUBLE PRECISION,
    "defaultLocation" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FarmerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmerPrimaryCrop" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "seasonal" BOOLEAN NOT NULL DEFAULT false,
    "defaultQuantity" DOUBLE PRECISION NOT NULL,
    "harvestMonths" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FarmerPrimaryCrop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportResponse" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isStaff" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallbackRequest" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "preferredTime" TEXT NOT NULL,
    "issue" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallbackRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "previousBalance" DOUBLE PRECISION NOT NULL,
    "newBalance" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "reference" TEXT,
    "flwTxRef" TEXT,
    "flwRef" TEXT,
    "flwStatus" TEXT,
    "flwMessage" TEXT,
    "paymentMethod" TEXT,
    "externalTxId" TEXT,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "duration" INTEGER NOT NULL,
    "features" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantSubscription" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3) NOT NULL,
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "paymentMethod" "PaymentMethod",
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "txRef" TEXT,
    "flwRef" TEXT,
    "transactionId" TEXT,
    "amountPaid" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPayment" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "txRef" TEXT,
    "flwRef" TEXT,
    "transactionId" TEXT,
    "flwStatus" TEXT,
    "flwMessage" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionHistory" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "action" "SubscriptionAction" NOT NULL,
    "oldStatus" "SubscriptionStatus",
    "newStatus" "SubscriptionStatus",
    "oldPlanId" TEXT,
    "newPlanId" TEXT,
    "reason" TEXT,
    "performedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Voucher" (
    "id" TEXT NOT NULL,
    "voucherCode" TEXT NOT NULL,
    "voucherType" "VoucherType" NOT NULL,
    "discountPercentage" DOUBLE PRECISION NOT NULL,
    "creditLimit" DOUBLE PRECISION NOT NULL,
    "minTransactionAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxTransactionAmount" DOUBLE PRECISION,
    "totalCredit" DOUBLE PRECISION NOT NULL,
    "usedCredit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remainingCredit" DOUBLE PRECISION NOT NULL,
    "status" "VoucherStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiryDate" TIMESTAMP(3),
    "issuedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "restaurantId" TEXT NOT NULL,
    "loanId" TEXT,
    "serviceFeeRate" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanApplication" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "requestedAmount" DOUBLE PRECISION NOT NULL,
    "purpose" TEXT,
    "status" "LoanStatus" NOT NULL DEFAULT 'PENDING',
    "approvedAmount" DOUBLE PRECISION,
    "approvedBy" TEXT,
    "disbursementDate" TIMESTAMP(3),
    "repaymentDueDate" TIMESTAMP(3),
    "terms" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "LoanApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoucherTransaction" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "originalAmount" DOUBLE PRECISION NOT NULL,
    "discountPercentage" DOUBLE PRECISION NOT NULL,
    "discountAmount" DOUBLE PRECISION NOT NULL,
    "amountCharged" DOUBLE PRECISION NOT NULL,
    "serviceFee" DOUBLE PRECISION NOT NULL,
    "totalDeducted" DOUBLE PRECISION NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoucherTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoucherRepayment" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT,
    "restaurantId" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "paymentReference" TEXT,
    "allocatedToPrincipal" DOUBLE PRECISION NOT NULL,
    "allocatedToServiceFee" DOUBLE PRECISION NOT NULL,
    "allocatedToPenalty" DOUBLE PRECISION NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoucherRepayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoucherPenalty" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "penaltyAmount" DOUBLE PRECISION NOT NULL,
    "daysOverdue" INTEGER NOT NULL,
    "penaltyRate" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "status" "PenaltyStatus" NOT NULL DEFAULT 'PENDING',
    "appliedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoucherPenalty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FarmerSecurityEvent_farmerId_idx" ON "FarmerSecurityEvent"("farmerId");

-- CreateIndex
CREATE INDEX "FarmerSecurityEvent_eventType_idx" ON "FarmerSecurityEvent"("eventType");

-- CreateIndex
CREATE INDEX "FarmerSecurityQuestion_farmerId_idx" ON "FarmerSecurityQuestion"("farmerId");

-- CreateIndex
CREATE INDEX "FarmerLoginAttempt_farmerId_idx" ON "FarmerLoginAttempt"("farmerId");

-- CreateIndex
CREATE INDEX "FarmerLoginAttempt_attemptTime_idx" ON "FarmerLoginAttempt"("attemptTime");

-- CreateIndex
CREATE INDEX "FarmerSecurityAlert_farmerId_idx" ON "FarmerSecurityAlert"("farmerId");

-- CreateIndex
CREATE INDEX "FarmerSecurityAlert_severity_idx" ON "FarmerSecurityAlert"("severity");

-- CreateIndex
CREATE UNIQUE INDEX "FarmerProfile_farmerId_key" ON "FarmerProfile"("farmerId");

-- CreateIndex
CREATE INDEX "FarmerProfile_farmerId_idx" ON "FarmerProfile"("farmerId");

-- CreateIndex
CREATE INDEX "FarmerPrimaryCrop_farmerId_idx" ON "FarmerPrimaryCrop"("farmerId");

-- CreateIndex
CREATE INDEX "FarmerPrimaryCrop_productId_idx" ON "FarmerPrimaryCrop"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "SupportTicket_ticketNumber_key" ON "SupportTicket"("ticketNumber");

-- CreateIndex
CREATE INDEX "SupportTicket_farmerId_idx" ON "SupportTicket"("farmerId");

-- CreateIndex
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");

-- CreateIndex
CREATE INDEX "SupportTicket_ticketNumber_idx" ON "SupportTicket"("ticketNumber");

-- CreateIndex
CREATE INDEX "SupportResponse_ticketId_idx" ON "SupportResponse"("ticketId");

-- CreateIndex
CREATE INDEX "CallbackRequest_farmerId_idx" ON "CallbackRequest"("farmerId");

-- CreateIndex
CREATE INDEX "CallbackRequest_status_idx" ON "CallbackRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_restaurantId_key" ON "Wallet"("restaurantId");

-- CreateIndex
CREATE INDEX "Wallet_restaurantId_idx" ON "Wallet"("restaurantId");

-- CreateIndex
CREATE INDEX "Wallet_isActive_idx" ON "Wallet"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransaction_flwTxRef_key" ON "WalletTransaction"("flwTxRef");

-- CreateIndex
CREATE INDEX "WalletTransaction_walletId_idx" ON "WalletTransaction"("walletId");

-- CreateIndex
CREATE INDEX "WalletTransaction_type_idx" ON "WalletTransaction"("type");

-- CreateIndex
CREATE INDEX "WalletTransaction_status_idx" ON "WalletTransaction"("status");

-- CreateIndex
CREATE INDEX "WalletTransaction_createdAt_idx" ON "WalletTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "WalletTransaction_flwTxRef_idx" ON "WalletTransaction"("flwTxRef");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlan_name_key" ON "SubscriptionPlan"("name");

-- CreateIndex
CREATE INDEX "SubscriptionPlan_isActive_idx" ON "SubscriptionPlan"("isActive");

-- CreateIndex
CREATE INDEX "SubscriptionPlan_name_idx" ON "SubscriptionPlan"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantSubscription_txRef_key" ON "RestaurantSubscription"("txRef");

-- CreateIndex
CREATE INDEX "RestaurantSubscription_restaurantId_idx" ON "RestaurantSubscription"("restaurantId");

-- CreateIndex
CREATE INDEX "RestaurantSubscription_planId_idx" ON "RestaurantSubscription"("planId");

-- CreateIndex
CREATE INDEX "RestaurantSubscription_status_idx" ON "RestaurantSubscription"("status");

-- CreateIndex
CREATE INDEX "RestaurantSubscription_endDate_idx" ON "RestaurantSubscription"("endDate");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPayment_txRef_key" ON "SubscriptionPayment"("txRef");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_subscriptionId_idx" ON "SubscriptionPayment"("subscriptionId");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_paymentStatus_idx" ON "SubscriptionPayment"("paymentStatus");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_txRef_idx" ON "SubscriptionPayment"("txRef");

-- CreateIndex
CREATE INDEX "SubscriptionHistory_subscriptionId_idx" ON "SubscriptionHistory"("subscriptionId");

-- CreateIndex
CREATE INDEX "SubscriptionHistory_action_idx" ON "SubscriptionHistory"("action");

-- CreateIndex
CREATE INDEX "SubscriptionHistory_createdAt_idx" ON "SubscriptionHistory"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_voucherCode_key" ON "Voucher"("voucherCode");

-- CreateIndex
CREATE INDEX "Voucher_restaurantId_idx" ON "Voucher"("restaurantId");

-- CreateIndex
CREATE INDEX "Voucher_status_idx" ON "Voucher"("status");

-- CreateIndex
CREATE INDEX "Voucher_voucherCode_idx" ON "Voucher"("voucherCode");

-- CreateIndex
CREATE INDEX "Voucher_loanId_idx" ON "Voucher"("loanId");

-- CreateIndex
CREATE INDEX "LoanApplication_restaurantId_idx" ON "LoanApplication"("restaurantId");

-- CreateIndex
CREATE INDEX "LoanApplication_status_idx" ON "LoanApplication"("status");

-- CreateIndex
CREATE INDEX "LoanApplication_approvedBy_idx" ON "LoanApplication"("approvedBy");

-- CreateIndex
CREATE INDEX "VoucherTransaction_voucherId_idx" ON "VoucherTransaction"("voucherId");

-- CreateIndex
CREATE INDEX "VoucherTransaction_orderId_idx" ON "VoucherTransaction"("orderId");

-- CreateIndex
CREATE INDEX "VoucherTransaction_restaurantId_idx" ON "VoucherTransaction"("restaurantId");

-- CreateIndex
CREATE INDEX "VoucherTransaction_transactionDate_idx" ON "VoucherTransaction"("transactionDate");

-- CreateIndex
CREATE INDEX "VoucherRepayment_voucherId_idx" ON "VoucherRepayment"("voucherId");

-- CreateIndex
CREATE INDEX "VoucherRepayment_restaurantId_idx" ON "VoucherRepayment"("restaurantId");

-- CreateIndex
CREATE INDEX "VoucherRepayment_loanId_idx" ON "VoucherRepayment"("loanId");

-- CreateIndex
CREATE INDEX "VoucherRepayment_paymentDate_idx" ON "VoucherRepayment"("paymentDate");

-- CreateIndex
CREATE INDEX "VoucherPenalty_voucherId_idx" ON "VoucherPenalty"("voucherId");

-- CreateIndex
CREATE INDEX "VoucherPenalty_restaurantId_idx" ON "VoucherPenalty"("restaurantId");

-- CreateIndex
CREATE INDEX "VoucherPenalty_status_idx" ON "VoucherPenalty"("status");

-- CreateIndex
CREATE INDEX "VoucherPenalty_appliedDate_idx" ON "VoucherPenalty"("appliedDate");

-- CreateIndex
CREATE UNIQUE INDEX "Order_txRef_key" ON "Order"("txRef");

-- CreateIndex
CREATE INDEX "Order_paymentStatus_idx" ON "Order"("paymentStatus");

-- CreateIndex
CREATE INDEX "Order_paymentMethod_idx" ON "Order"("paymentMethod");

-- CreateIndex
CREATE INDEX "Order_txRef_idx" ON "Order"("txRef");

-- CreateIndex
CREATE INDEX "Order_flwRef_idx" ON "Order"("flwRef");

-- CreateIndex
CREATE INDEX "Order_transactionId_idx" ON "Order"("transactionId");

-- CreateIndex
CREATE INDEX "Order_flwStatus_idx" ON "Order"("flwStatus");

-- CreateIndex
CREATE INDEX "Order_cartId_idx" ON "Order"("cartId");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Restaurant_tin_key" ON "Restaurant"("tin");

-- AddForeignKey
ALTER TABLE "FarmerSecurityEvent" ADD CONSTRAINT "FarmerSecurityEvent_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmerSecurityQuestion" ADD CONSTRAINT "FarmerSecurityQuestion_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmerLoginAttempt" ADD CONSTRAINT "FarmerLoginAttempt_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmerSecurityAlert" ADD CONSTRAINT "FarmerSecurityAlert_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmerProfile" ADD CONSTRAINT "FarmerProfile_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmerPrimaryCrop" ADD CONSTRAINT "FarmerPrimaryCrop_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmerPrimaryCrop" ADD CONSTRAINT "FarmerPrimaryCrop_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportResponse" ADD CONSTRAINT "SupportResponse_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallbackRequest" ADD CONSTRAINT "CallbackRequest_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantSubscription" ADD CONSTRAINT "RestaurantSubscription_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantSubscription" ADD CONSTRAINT "RestaurantSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "RestaurantSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionHistory" ADD CONSTRAINT "SubscriptionHistory_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "RestaurantSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "LoanApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanApplication" ADD CONSTRAINT "LoanApplication_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanApplication" ADD CONSTRAINT "LoanApplication_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherTransaction" ADD CONSTRAINT "VoucherTransaction_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherTransaction" ADD CONSTRAINT "VoucherTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherTransaction" ADD CONSTRAINT "VoucherTransaction_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherRepayment" ADD CONSTRAINT "VoucherRepayment_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherRepayment" ADD CONSTRAINT "VoucherRepayment_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherRepayment" ADD CONSTRAINT "VoucherRepayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "LoanApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherPenalty" ADD CONSTRAINT "VoucherPenalty_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherPenalty" ADD CONSTRAINT "VoucherPenalty_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
