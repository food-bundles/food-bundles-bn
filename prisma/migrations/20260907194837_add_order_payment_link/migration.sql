-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paymentLinkExpiry" TIMESTAMP(3),
ADD COLUMN     "paymentLinkToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_paymentLinkToken_key" ON "Order"("paymentLinkToken");

-- CreateIndex
CREATE INDEX "Order_paymentLinkToken_idx" ON "Order"("paymentLinkToken");
