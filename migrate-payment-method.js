const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function migratePaymentMethod() {
  try {
    console.log("Starting payment method migration...");

    // Step 1: Add temporary column
    await prisma.$executeRaw`ALTER TABLE "Order" ADD COLUMN "paymentMethod_temp" TEXT`;
    console.log("Added temporary column");

    // Step 2: Copy existing enum values to temp column
    await prisma.$executeRaw`
      UPDATE "Order" SET "paymentMethod_temp" = 
        CASE 
          WHEN "paymentMethod" = 'CASH' THEN 'CASH'
          WHEN "paymentMethod" = 'MOBILE_MONEY' THEN 'MOBILE_MONEY'
          WHEN "paymentMethod" = 'BANK_TRANSFER' THEN 'BANK_TRANSFER'
          WHEN "paymentMethod" = 'CARD' THEN 'CARD'
          WHEN "paymentMethod" = 'VOUCHER' THEN 'VOUCHER'
          ELSE NULL
        END
    `;
    console.log("Copied existing data");

    // Step 3: Drop old column
    await prisma.$executeRaw`ALTER TABLE "Order" DROP COLUMN "paymentMethod"`;
    console.log("Dropped old column");

    // Step 4: Rename temp column
    await prisma.$executeRaw`ALTER TABLE "Order" RENAME COLUMN "paymentMethod_temp" TO "paymentMethod"`;
    console.log("Renamed column");

    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

migratePaymentMethod();
