/*
  Warnings:

  - The `status` column on the `Order` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[checkoutId]` on the table `Order` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[orderNumber]` on the table `Order` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `orderNumber` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."CartStatus" AS ENUM ('ACTIVE', 'CHECKED_OUT', 'ABANDONED');

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('CASH', 'MOBILE_MONEY', 'BANK_TRANSFER', 'CARD');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "public"."OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED', 'REFUNDED');

-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "actualDelivery" TIMESTAMP(3),
ADD COLUMN     "checkoutId" TEXT,
ADD COLUMN     "estimatedDelivery" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "orderNumber" TEXT NOT NULL,
ADD COLUMN     "paymentMethod" "public"."PaymentMethod",
ADD COLUMN     "paymentReference" TEXT,
ADD COLUMN     "paymentStatus" "public"."PaymentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "requestedDelivery" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "public"."OrderStatus" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "public"."Cart" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "public"."CartStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CartItem" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CHECKOUT" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "paymentMethod" "public"."PaymentMethod" NOT NULL,
    "paymentStatus" "public"."PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "billingName" TEXT,
    "billingEmail" TEXT,
    "billingPhone" TEXT,
    "billingAddress" TEXT,
    "paymentReference" TEXT,
    "transactionId" TEXT,
    "notes" TEXT,
    "deliveryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "orderId" TEXT,

    CONSTRAINT "CHECKOUT_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Cart_restaurantId_idx" ON "public"."Cart"("restaurantId");

-- CreateIndex
CREATE INDEX "Cart_status_idx" ON "public"."Cart"("status");

-- CreateIndex
CREATE INDEX "CartItem_cartId_idx" ON "public"."CartItem"("cartId");

-- CreateIndex
CREATE INDEX "CartItem_productId_idx" ON "public"."CartItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartId_productId_key" ON "public"."CartItem"("cartId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "CHECKOUT_cartId_key" ON "public"."CHECKOUT"("cartId");

-- CreateIndex
CREATE UNIQUE INDEX "CHECKOUT_orderId_key" ON "public"."CHECKOUT"("orderId");

-- CreateIndex
CREATE INDEX "CHECKOUT_restaurantId_idx" ON "public"."CHECKOUT"("restaurantId");

-- CreateIndex
CREATE INDEX "CHECKOUT_paymentStatus_idx" ON "public"."CHECKOUT"("paymentStatus");

-- CreateIndex
CREATE INDEX "CHECKOUT_paymentMethod_idx" ON "public"."CHECKOUT"("paymentMethod");

-- CreateIndex
CREATE UNIQUE INDEX "Order_checkoutId_key" ON "public"."Order"("checkoutId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "public"."Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_restaurantId_idx" ON "public"."Order"("restaurantId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "public"."Order"("status");

-- CreateIndex
CREATE INDEX "Order_orderNumber_idx" ON "public"."Order"("orderNumber");

-- AddForeignKey
ALTER TABLE "public"."Cart" ADD CONSTRAINT "Cart_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "public"."Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "public"."Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CartItem" ADD CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CHECKOUT" ADD CONSTRAINT "CHECKOUT_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "public"."Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CHECKOUT" ADD CONSTRAINT "CHECKOUT_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "public"."Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CHECKOUT" ADD CONSTRAINT "CHECKOUT_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
