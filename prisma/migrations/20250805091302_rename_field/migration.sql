/*
  Warnings:

  - You are about to drop the column `unitPrice` on the `FarmerSubmission` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Product` table. All the data in the column will be lost.
  - Added the required column `productName` to the `Product` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."ProductStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "public"."FarmerSubmission" DROP COLUMN "unitPrice",
ADD COLUMN     "acceptedPrice" DOUBLE PRECISION,
ADD COLUMN     "approvedProductId" TEXT,
ADD COLUMN     "wishedPrice" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "public"."Product" DROP COLUMN "name",
ADD COLUMN     "productName" TEXT NOT NULL,
ADD COLUMN     "status" "public"."ProductStatus" NOT NULL DEFAULT 'ACTIVE';

-- AddForeignKey
ALTER TABLE "public"."FarmerSubmission" ADD CONSTRAINT "FarmerSubmission_approvedProductId_fkey" FOREIGN KEY ("approvedProductId") REFERENCES "public"."Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
