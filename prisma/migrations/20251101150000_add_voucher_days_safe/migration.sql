-- Add voucherDays column to LoanApplication table (safe version)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'LoanApplication') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'LoanApplication' AND column_name = 'voucherDays') THEN
            ALTER TABLE "LoanApplication" ADD COLUMN "voucherDays" INTEGER;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'LoanApplication' AND column_name = 'terms') THEN
            UPDATE "LoanApplication"
            SET "voucherDays" = CASE
                WHEN "terms" ~ '^[0-9]+$' THEN CAST("terms" AS INTEGER)
                ELSE NULL
            END
            WHERE "terms" IS NOT NULL;
        END IF;
    END IF;
END $$;
