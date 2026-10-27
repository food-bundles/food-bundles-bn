-- AlterTable
ALTER TABLE "Farmer" ADD COLUMN "latitude" DOUBLE PRECISION,
ADD COLUMN "longitude" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "FarmerSubmission" ADD COLUMN "aggregationSiteId" TEXT;

-- CreateTable
CREATE TABLE "AggregationSite" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "marketName" TEXT NOT NULL,
    "province" TEXT,
    "district" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastPriceDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AggregationSite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AggregationSite_marketName_key" ON "AggregationSite"("marketName");

-- CreateIndex
CREATE INDEX "AggregationSite_district_idx" ON "AggregationSite"("district");

-- CreateIndex
CREATE INDEX "AggregationSite_isActive_idx" ON "AggregationSite"("isActive");

-- AddForeignKey
ALTER TABLE "FarmerSubmission" ADD CONSTRAINT "FarmerSubmission_aggregationSiteId_fkey" FOREIGN KEY ("aggregationSiteId") REFERENCES "AggregationSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
