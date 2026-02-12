import prisma from "../prisma";
import { VoucherStatus } from "@prisma/client";
import { sendMessage } from "../utils/sms.utility";

/**
 * Check vouchers and send reminders
 * - 1 day before maturity: Send reminder with amount to be paid
 * - After maturity: Send daily reminder to pay voucher amount
 */
export const sendVoucherMaturityRemindersService = async () => {
  try {
    const now = new Date();
    const results = {
      usedVouchersFound: 0,
      maturedVouchersFound: 0,
      remindersSent: 0,
      skipped: [] as string[],
      sent: [] as string[],
    };
    
    // Get all USED vouchers
    const usedVouchers = await prisma.voucher.findMany({
      where: {
        status: VoucherStatus.USED,
        usedAt: { not: null },
        repaymentDays: { gt: 0 },
      },
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
    });

    results.usedVouchersFound = usedVouchers.length;
    console.log(`Found ${usedVouchers.length} USED vouchers`);

    for (const voucher of usedVouchers) {
      if (!voucher.usedAt) {
        results.skipped.push(`${voucher.voucherCode}: No usedAt date`);
        continue;
      }
      
      if (!voucher.restaurant?.phone) {
        results.skipped.push(`${voucher.voucherCode}: No phone number`);
        continue;
      }

      const usedDate = new Date(voucher.usedAt);
      const maturityDate = new Date(
        usedDate.getTime() + voucher.repaymentDays * 24 * 60 * 60 * 1000
      );
      const daysUntilMaturity = Math.ceil((maturityDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const amountToPay = voucher.usedCredit;

      console.log(`Voucher ${voucher.voucherCode}: ${daysUntilMaturity} days until maturity`);

      if (daysUntilMaturity === 1) {
        await sendMessage(
          `Reminder: Your voucher ${voucher.voucherCode} will mature tomorrow. Amount to pay: ${amountToPay.toLocaleString()} RWF. Please ensure payment is ready.`,
          voucher.restaurant.phone
        );
        results.remindersSent++;
        results.sent.push(`${voucher.voucherCode} (pre-maturity)`);
        console.log(`Pre-maturity reminder sent for voucher ${voucher.voucherCode}`);
      } else {
        results.skipped.push(`${voucher.voucherCode}: ${daysUntilMaturity} days until maturity`);
      }
    }

    // Get all MATURED vouchers
    const maturedVouchers = await prisma.voucher.findMany({
      where: {
        status: VoucherStatus.MATURED,
        remainingAmount: { gt: 0 },
      },
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
    });

    results.maturedVouchersFound = maturedVouchers.length;
    console.log(`Found ${maturedVouchers.length} MATURED vouchers`);

    for (const voucher of maturedVouchers) {
      if (!voucher.restaurant?.phone) {
        results.skipped.push(`${voucher.voucherCode}: No phone number`);
        continue;
      }

      const amountToPay = voucher.remainingAmount;
      
      await sendMessage(
        `URGENT: Your voucher ${voucher.voucherCode} has matured. Outstanding amount: ${amountToPay.toLocaleString()} RWF. Please pay today to avoid interuption of supply.`,
        voucher.restaurant.phone
      );
      results.remindersSent++;
      results.sent.push(`${voucher.voucherCode} (matured)`);
      console.log(`Maturity reminder sent for voucher ${voucher.voucherCode}`);
    }

    return {
      success: true,
      ...results,
      message: `Sent ${results.remindersSent} voucher reminders`,
    };
  } catch (error: any) {
    console.error("Failed to send voucher reminders:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};
