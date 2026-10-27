import { Request, Response } from "express";
import {
  pesapalSubmitOrder,
  pesapalGetTransactionStatus,
  pesapalRequestRefund,
  pesapalCancelOrder,
  pesapalRegisterIPN,
  pesapalGetIPNList,
} from "../../services/payment/pesapal-payment.service";

export const submitPesapalOrder = async (req: Request, res: Response) => {
  const { id, currency, amount, description, callback_url, notification_id, billing_address } = req.body;
  if (!id || !amount || !description || !callback_url || !notification_id || !billing_address) {
    return res.status(400).json({ success: false, message: "id, amount, description, callback_url, notification_id, and billing_address are required" });
  }
  try {
    const result = await pesapalSubmitOrder({ ...req.body, currency: currency || "RWF" });
    return res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getPesapalTransactionStatus = async (req: Request, res: Response) => {
  const { orderTrackingId } = req.params;
  if (!orderTrackingId) {
    return res.status(400).json({ success: false, message: "orderTrackingId is required" });
  }
  try {
    const result = await pesapalGetTransactionStatus(orderTrackingId);
    return res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const refundPesapalPayment = async (req: Request, res: Response) => {
  const { confirmation_code, amount, username, remarks } = req.body;
  if (!confirmation_code || !amount || !username || !remarks) {
    return res.status(400).json({ success: false, message: "confirmation_code, amount, username, and remarks are required" });
  }
  try {
    const result = await pesapalRequestRefund({ confirmation_code, amount, username, remarks });
    return res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const cancelPesapalOrder = async (req: Request, res: Response) => {
  const { order_tracking_id } = req.body;
  if (!order_tracking_id) {
    return res.status(400).json({ success: false, message: "order_tracking_id is required" });
  }
  try {
    const result = await pesapalCancelOrder(order_tracking_id);
    return res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const registerPesapalIPN = async (req: Request, res: Response) => {
  const { url, ipn_notification_type } = req.body;
  if (!url) {
    return res.status(400).json({ success: false, message: "url is required" });
  }
  try {
    const result = await pesapalRegisterIPN(url, ipn_notification_type);
    return res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getPesapalIPNList = async (_req: Request, res: Response) => {
  try {
    const result = await pesapalGetIPNList();
    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
