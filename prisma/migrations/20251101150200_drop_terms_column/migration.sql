-- Drop the terms column now that data has been migrated to voucherDays
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'LoanApplication' AND column_name = 'terms') THEN
        ALTER TABLE "LoanApplication" DROP COLUMN "terms";
    END IF;
END $$;