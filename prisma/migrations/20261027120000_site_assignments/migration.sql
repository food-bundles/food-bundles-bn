-- AlterTable
ALTER TABLE "Farmer" ADD COLUMN "aggregationSiteId" TEXT,
ADD COLUMN "siteAssignedByAdmin" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Admin" ADD COLUMN "aggregationSiteId" TEXT,
ADD COLUMN "siteAssignedByAdmin" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Farmer_aggregationSiteId_idx" ON "Farmer"("aggregationSiteId");

-- CreateIndex
CREATE INDEX "Admin_aggregationSiteId_idx" ON "Admin"("aggregationSiteId");

-- AddForeignKey
ALTER TABLE "Farmer" ADD CONSTRAINT "Farmer_aggregationSiteId_fkey" FOREIGN KEY ("aggregationSiteId") REFERENCES "AggregationSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_aggregationSiteId_fkey" FOREIGN KEY ("aggregationSiteId") REFERENCES "AggregationSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
