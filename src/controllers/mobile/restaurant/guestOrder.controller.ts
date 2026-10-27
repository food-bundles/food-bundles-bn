import { Request, Response } from "express";
import { createGuestOrderService } from "../../../services/mobile/restaurant/guestOrder.service";

export const mobileCreateGuestOrder = async (req: Request, res: Response) => {
  try {
    const { lines, contactName, contactPhone, deliveryStreet, deliveryLandmark, paymentMethod } = req.body;

    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ success: false, message: "Order lines are required" });
    }
    if (!contactName || !contactPhone || !deliveryStreet) {
      return res.status(400).json({ success: false, message: "Contact name, phone, and delivery address are required" });
    }

    const result = await createGuestOrderService({
      lines,
      contactName,
      contactPhone,
      deliveryStreet,
      deliveryLandmark,
      paymentMethod: paymentMethod ?? "MOBILE_MONEY",
    });

    res.status(201).json({ success: true, message: "Order placed", data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};
