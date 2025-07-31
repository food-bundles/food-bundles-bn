/*
  Warnings:

  - You are about to drop the column `pricePerUnit` on the `OrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `stockQuantity` on the `Product` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[sku]` on the table `Product` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `unitPrice` to the `OrderItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `bonus` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdBy` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `quantity` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sku` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `category` on the `Product` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "public"."ProductCategory" AS ENUM ('VEGETABLES', 'FRUITS', 'GRAINS', 'TUBERS', 'LEGUMES', 'HERBS_SPICES');

-- AlterTable
ALTER TABLE "public"."OrderItem" DROP COLUMN "pricePerUnit",
ADD COLUMN     "unitPrice" DOUBLE PRECISION NOT NULL;

-- AlterTable
ALTER TABLE "public"."Product" DROP COLUMN "stockQuantity",
ADD COLUMN     "bonus" INTEGER NOT NULL,
ADD COLUMN     "createdBy" TEXT NOT NULL,
ADD COLUMN     "expiryDate" TIMESTAMP(3),
ADD COLUMN     "images" TEXT[],
ADD COLUMN     "quantity" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "sku" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "category",
ADD COLUMN     "category" "public"."ProductCategory" NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "public"."Product"("sku");

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
