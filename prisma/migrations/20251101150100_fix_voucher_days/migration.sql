-- Check if voucherDays column exists, if not add it
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'LoanApplication' AND column_name = 'voucherDays') THEN
        ALTER TABLE "LoanApplication" ADD COLUMN "voucherDays" INTEGER;
    END IF;
END $$;

-- Copy numeric values from terms to voucherDays where possible (only if terms column exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'LoanApplication' AND column_name = 'terms') THEN
        UPDATE "LoanApplication" 
        SET "voucherDays" = CASE 
            WHEN "terms" ~ '^[0-9]+$' THEN CAST("terms" AS INTEGER)
            ELSE NULL 
        END
        WHERE "terms" IS NOT NULL AND "voucherDays" IS NULL;
    END IF;
END $$;