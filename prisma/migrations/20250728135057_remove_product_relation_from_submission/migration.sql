/*
  Warnings:

  - You are about to drop the column `productId` on the `FarmerSubmission` table. All the data in the column will be lost.
  - Added the required column `productName` to the `FarmerSubmission` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "FarmerSubmission" DROP CONSTRAINT "FarmerSubmission_productId_fkey";

-- AlterTable
ALTER TABLE "FarmerSubmission" DROP COLUMN "productId",
ADD COLUMN     "productName" TEXT NOT NULL;
