import { Request, Response } from "express";
import { sendPriceUpdateNotificationsService } from "../services/notification.services";

export const sendPriceUpdateNotifications = async (
  req: Request,
  res: Response
) => {
  try {
    const result = await sendPriceUpdateNotificationsService();
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to send price update notifications",
    });
  }
};
