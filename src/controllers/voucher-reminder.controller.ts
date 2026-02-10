import { Request, Response } from "express";
import { sendVoucherMaturityRemindersService } from "../services/voucher-reminder.service";

/**
 * Send voucher maturity reminders
 * This should be called by a cron job daily
 * GET /vouchers/reminders/send
 */
export const sendVoucherReminders = async (req: Request, res: Response) => {
  try {
    const result = await sendVoucherMaturityRemindersService();
    
    const message = 'message' in result 
      ? result.message 
      : (result.success ? "Reminders sent successfully" : "Failed to send reminders");
    
    res.status(200).json({
      message,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to send voucher reminders",
    });
  }
};

