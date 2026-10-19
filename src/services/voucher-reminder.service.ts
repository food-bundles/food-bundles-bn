import prisma from "../prisma";
import { VoucherStatus, NotificationCategory } from "@prisma/client";
import { sendMessage } from "../utils/sms.utility";
import {
  getRecipientsByCategoryService,
  sendToRecipientsByCategoryService,
} from "./notification-recipient.service";
import {
  sendVoucherMaturingSoonEmail,
  sendAdminVoucherMaturingSoonEmail,
} from "../utils/emails";
import { createNotificationService } from "./notification.services";

/**
 * Check vouchers and send reminders
 * - 1 day before maturity: Send reminder with amount to be paid
 * - After maturity: Send daily reminder to pay voucher amount
 * - Send summary to admin recipients
 */
export const sendVoucherMaturityRemindersService = async () => {
  try {
    const now = new Date();
    const results = {
      usedVouchersFound: 0,
      maturedVouchersFound: 0,
      expiredVouchersFound: 0,
      remindersSent: 0,
      adminNotificationsSent: 0,
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
            email: true,
          },
        },
      },
    });

    results.usedVouchersFound = usedVouchers.length;
    console.log(`Found ${usedVouchers.length} USED vouchers`);

    const maturingSoonForAdmin: {
      restaurantName: string;
      voucherCode: string;
      amountDue: number;
      maturityDate: Date;
    }[] = [];

    for (const voucher of usedVouchers) {
      if (!voucher.usedAt) {
        results.skipped.push(`${voucher.voucherCode}: No usedAt date`);
        continue;
      }

      const usedDate = new Date(voucher.usedAt);
      const maturityDate = new Date(
        usedDate.getTime() + voucher.repaymentDays * 24 * 60 * 60 * 1000
      );
      const daysUntilMaturity = Math.ceil((maturityDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const amountToPay = voucher.usedCredit;

      console.log(`Voucher ${voucher.voucherCode}: ${daysUntilMaturity} days until maturity`);

      // 48-hour email + in-app heads-up, additive to the 24h SMS reminder
      // below. Guarded by maturingSoonNotified so it fires exactly once per
      // voucher regardless of how many times this job runs while 2 days
      // remain.
      if (daysUntilMaturity === 2 && !voucher.maturingSoonNotified) {
        if (voucher.restaurant?.email) {
          try {
            await sendVoucherMaturingSoonEmail({
              email: voucher.restaurant.email,
              restaurantName: voucher.restaurant.name,
              voucherCode: voucher.voucherCode,
              amountDue: amountToPay,
              maturityDate,
            });
          } catch (emailError) {
            console.error("Failed to send voucher maturing soon email:", emailError);
          }
        }

        if (voucher.restaurantId) {
          try {
            await createNotificationService({
              title: "Voucher Due Soon",
              message: `Your voucher ${voucher.voucherCode} (${amountToPay.toLocaleString()} RWF) is due in 48 hours.`,
              eventType: "VOUCHER_MATURING_SOON",
              targetType: "SPECIFIC_USER",
              targetId: voucher.restaurantId,
              metadata: { voucherId: voucher.id, voucherCode: voucher.voucherCode, amountDue: amountToPay },
            });
          } catch (notifError) {
            console.error("Failed to create voucher maturing soon notification:", notifError);
          }
        }

        maturingSoonForAdmin.push({
          restaurantName: voucher.restaurant?.name || "Unknown",
          voucherCode: voucher.voucherCode,
          amountDue: amountToPay,
          maturityDate,
        });

        try {
          await prisma.voucher.update({
            where: { id: voucher.id },
            data: { maturingSoonNotified: true },
          });
        } catch (updateError) {
          console.error("Failed to mark voucher as maturing-soon-notified:", updateError);
        }
      }

      if (!voucher.restaurant?.phone) {
        results.skipped.push(`${voucher.voucherCode}: No phone number`);
        continue;
      }

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

    // Admin email + in-app summary for vouchers maturing in 48 hours
    if (maturingSoonForAdmin.length > 0) {
      try {
        if (process.env.ADMIN_EMAIL) {
          await sendAdminVoucherMaturingSoonEmail({ vouchers: maturingSoonForAdmin });
        }
      } catch (emailError) {
        console.error("Failed to send admin voucher maturing soon email:", emailError);
      }

      try {
        const totalAmount = maturingSoonForAdmin.reduce((sum, v) => sum + v.amountDue, 0);
        await createNotificationService({
          title: "Vouchers Due Soon",
          message: `${maturingSoonForAdmin.length} voucher(s) totaling ${totalAmount.toLocaleString()} RWF are due in 48 hours.`,
          eventType: "VOUCHER_MATURING_SOON",
          targetType: "ROLE_BASED",
          targetRole: "ADMIN",
          metadata: { count: maturingSoonForAdmin.length, totalAmount },
        });
      } catch (notifError) {
        console.error("Failed to create admin voucher maturing soon notification:", notifError);
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

    if (maturedVouchers.length > 0) {
      try {
        const voucherSummary = maturedVouchers
          .map(
            (v) =>
              `${v.restaurant?.name || "Unknown"}: ${v.voucherCode} - ${v.remainingAmount.toLocaleString()} RWF`
          )
          .join("\n");

        const totalAmount = maturedVouchers.reduce(
          (sum, v) => sum + v.remainingAmount,
          0
        );

        const adminMessage = `MATURED VOUCHERS ALERT\n\nTotal: ${maturedVouchers.length} voucher(s)\nTotal Amount: ${totalAmount.toLocaleString()} RWF\n\nDetails:\n${voucherSummary}`;

        const { recipientCount } = await sendToRecipientsByCategoryService(
          NotificationCategory.MATURED_VOUCHERS,
          {
            subject: `Matured Vouchers Alert — ${maturedVouchers.length} voucher(s)`,
            body: adminMessage,
          }
        );
        results.adminNotificationsSent += recipientCount;
      } catch (error) {
        console.error("Failed to send matured vouchers notifications:", error);
      }
    }

    // Get all EXPIRED vouchers and send summary to admin recipients
    const expiredVouchers = await prisma.voucher.findMany({
      where: {
        status: VoucherStatus.EXPIRED,
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

    results.expiredVouchersFound = expiredVouchers.length;
    console.log(`Found ${expiredVouchers.length} EXPIRED vouchers`);

    if (expiredVouchers.length > 0) {
      try {
        const voucherSummary = expiredVouchers
          .map(
            (v) =>
              `${v.restaurant?.name || "Unknown"}: ${v.voucherCode} - ${v.creditLimit.toLocaleString()} RWF`
          )
          .join("\n");

        const totalCreditLimit = expiredVouchers.reduce(
          (sum, v) => sum + v.creditLimit,
          0
        );

        const adminMessage = `EXPIRED VOUCHERS ALERT\n\nTotal: ${expiredVouchers.length} voucher(s)\nTotal Credit: ${totalCreditLimit.toLocaleString()} RWF\n\nDetails:\n${voucherSummary}`;

        const { recipientCount } = await sendToRecipientsByCategoryService(
          NotificationCategory.EXPIRED_VOUCHERS,
          {
            subject: `Expired Vouchers Alert — ${expiredVouchers.length} voucher(s)`,
            body: adminMessage,
          }
        );
        results.adminNotificationsSent += recipientCount;
      } catch (error) {
        console.error("Failed to send expired vouchers notifications:", error);
      }
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
