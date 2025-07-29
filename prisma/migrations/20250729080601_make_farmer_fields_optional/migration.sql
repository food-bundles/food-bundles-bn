/*
  Warnings:

  - A unique constraint covering the columns `[phone]` on the table `Farmer` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Farmer" ADD COLUMN     "phone" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Farmer_phone_key" ON "Farmer"("phone");
