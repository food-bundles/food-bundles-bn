import cron from "node-cron";
import { sendVoucherMaturityRemindersService } from "../services/voucher-reminder.service";

/**
 * Schedule voucher maturity reminders
 * Runs daily at 7:00 AM (00 07)
 */
export const scheduleVoucherReminders = () => {
  // Run every day at 7:00 AM
  cron.schedule("00 07 * * *", async () => {
    console.log("Running voucher maturity reminders...");
    try {
      const result = await sendVoucherMaturityRemindersService();
      console.log(
        `Voucher reminders completed: ${result.success ? "Success" : "Failure"}`,
      );
    } catch (error) {
      console.error("Failed to send voucher reminders:", error);
    }
  });

  console.log("Voucher reminder scheduler initialized - runs daily at 7:00 AM");
};
