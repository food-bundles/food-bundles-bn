-- Add agreed field to Restaurant table
ALTER TABLE "Restaurant" ADD COLUMN "agreed" BOOLEAN NOT NULL DEFAULT false;