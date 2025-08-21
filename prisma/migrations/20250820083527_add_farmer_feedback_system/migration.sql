-- CreateEnum
CREATE TYPE "public"."FarmerFeedbackStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXTENDED');

-- AlterEnum
ALTER TYPE "public"."ProductCategory" ADD VALUE 'OTHER';

-- AlterTable
ALTER TABLE "public"."FarmerSubmission" ADD COLUMN     "category" "public"."ProductCategory" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "farmerCounterOffer" DOUBLE PRECISION,
ADD COLUMN     "farmerCounterQty" DOUBLE PRECISION,
ADD COLUMN     "farmerFeedbackAt" TIMESTAMP(3),
ADD COLUMN     "farmerFeedbackNotes" TEXT,
ADD COLUMN     "farmerFeedbackStatus" "public"."FarmerFeedbackStatus" DEFAULT 'PENDING',
ADD COLUMN     "feedbackDeadline" TIMESTAMP(3);
