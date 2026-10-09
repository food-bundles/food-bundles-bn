-- CreateTable
CREATE TABLE "CustomerType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCustomerPrice" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "customerTypeId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCustomerPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerType_name_key" ON "CustomerType"("name");

-- CreateIndex
CREATE INDEX "CustomerType_name_idx" ON "CustomerType"("name");

-- CreateIndex
CREATE INDEX "CustomerType_isActive_idx" ON "CustomerType"("isActive");

-- CreateIndex
CREATE INDEX "ProductCustomerPrice_productId_idx" ON "ProductCustomerPrice"("productId");

-- CreateIndex
CREATE INDEX "ProductCustomerPrice_customerTypeId_idx" ON "ProductCustomerPrice"("customerTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCustomerPrice_productId_customerTypeId_key" ON "ProductCustomerPrice"("productId", "customerTypeId");

-- AddForeignKey
ALTER TABLE "CustomerType" ADD CONSTRAINT "CustomerType_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCustomerPrice" ADD CONSTRAINT "ProductCustomerPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCustomerPrice" ADD CONSTRAINT "ProductCustomerPrice_customerTypeId_fkey" FOREIGN KEY ("customerTypeId") REFERENCES "CustomerType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
