const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function migrateAllPaymentMethods() {
  try {
    console.log('Starting comprehensive payment method migration...');
    
    // Migrate SubscriptionPayment table
    console.log('Migrating SubscriptionPayment table...');
    await prisma.$executeRaw`ALTER TABLE "SubscriptionPayment" ADD COLUMN "paymentMethod_temp" TEXT`;
    await prisma.$executeRaw`
      UPDATE "SubscriptionPayment" SET "paymentMethod_temp" = 
        CASE 
          WHEN "paymentMethod" = 'CASH' THEN 'CASH'
          WHEN "paymentMethod" = 'MOBILE_MONEY' THEN 'MOBILE_MONEY'
          WHEN "paymentMethod" = 'BANK_TRANSFER' THEN 'BANK_TRANSFER'
          WHEN "paymentMethod" = 'CARD' THEN 'CARD'
          WHEN "paymentMethod" = 'VOUCHER' THEN 'VOUCHER'
          ELSE NULL
        END
    `;
    await prisma.$executeRaw`ALTER TABLE "SubscriptionPayment" DROP COLUMN "paymentMethod"`;
    await prisma.$executeRaw`ALTER TABLE "SubscriptionPayment" RENAME COLUMN "paymentMethod_temp" TO "paymentMethod"`;
    await prisma.$executeRaw`ALTER TABLE "SubscriptionPayment" ALTER COLUMN "paymentMethod" SET NOT NULL`;
    console.log('SubscriptionPayment migration completed');
    
    // Migrate VoucherRepayment table
    console.log('Migrating VoucherRepayment table...');
    await prisma.$executeRaw`ALTER TABLE "VoucherRepayment" ADD COLUMN "paymentMethod_temp" TEXT`;
    await prisma.$executeRaw`
      UPDATE "VoucherRepayment" SET "paymentMethod_temp" = 
        CASE 
          WHEN "paymentMethod" = 'CASH' THEN 'CASH'
          WHEN "paymentMethod" = 'MOBILE_MONEY' THEN 'MOBILE_MONEY'
          WHEN "paymentMethod" = 'BANK_TRANSFER' THEN 'BANK_TRANSFER'
          WHEN "paymentMethod" = 'CARD' THEN 'CARD'
          WHEN "paymentMethod" = 'VOUCHER' THEN 'VOUCHER'
          ELSE NULL
        END
    `;
    await prisma.$executeRaw`ALTER TABLE "VoucherRepayment" DROP COLUMN "paymentMethod"`;
    await prisma.$executeRaw`ALTER TABLE "VoucherRepayment" RENAME COLUMN "paymentMethod_temp" TO "paymentMethod"`;
    await prisma.$executeRaw`ALTER TABLE "VoucherRepayment" ALTER COLUMN "paymentMethod" SET NOT NULL`;
    console.log('VoucherRepayment migration completed');
    
    console.log('All payment method migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateAllPaymentMethods();