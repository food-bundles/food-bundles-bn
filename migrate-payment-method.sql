-- Migration script to preserve paymentMethod data
-- Run this before doing prisma db push

-- Step 1: Add a temporary column
ALTER TABLE "Order" ADD COLUMN "paymentMethod_temp" TEXT;

-- Step 2: Copy existing enum values to the temp column
UPDATE "Order" SET "paymentMethod_temp" = 
  CASE 
    WHEN "paymentMethod" = 'CASH' THEN 'CASH'
    WHEN "paymentMethod" = 'MOBILE_MONEY' THEN 'MOBILE_MONEY'
    WHEN "paymentMethod" = 'BANK_TRANSFER' THEN 'BANK_TRANSFER'
    WHEN "paymentMethod" = 'CARD' THEN 'CARD'
    WHEN "paymentMethod" = 'VOUCHER' THEN 'VOUCHER'
    ELSE NULL
  END;

-- Step 3: Drop the old column
ALTER TABLE "Order" DROP COLUMN "paymentMethod";

-- Step 4: Rename temp column
ALTER TABLE "Order" RENAME COLUMN "paymentMethod_temp" TO "paymentMethod";