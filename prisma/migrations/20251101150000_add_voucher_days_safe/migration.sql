-- Add voucherDays column to LoanApplication table
ALTER TABLE "LoanApplication" ADD COLUMN "voucherDays" INTEGER;

-- Copy numeric values from terms to voucherDays where possible
UPDATE "LoanApplication" 
SET "voucherDays" = CASE 
    WHEN "terms" ~ '^[0-9]+$' THEN CAST("terms" AS INTEGER)
    ELSE NULL 
END
WHERE "terms" IS NOT NULL;