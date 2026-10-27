import { Request, Response } from "express";
import {
  mtnRequestToPay,
  mtnGetPaymentStatus,
  mtnGetAccountBalance,
} from "../../services/payment/mtn-payment.service";

export const requestMtnPayment = async (req: Request, res: Response) => {
  const { amount, phoneNumber, externalId, payerMessage, payeeNote, callbackUrl } = req.body;
  if (!amount || !phoneNumber || !externalId) {
    return res.status(400).json({ success: false, message: "amount, phoneNumber, and externalId are required" });
  }
  const result = await mtnRequestToPay({
    amount,
    phoneNumber,
    externalId,
    payerMessage: payerMessage || "Payment",
    payeeNote: payeeNote || "Payment",
    callbackUrl,
  });
  return res.status(result.success ? 200 : 400).json(result);
};

export const getMtnPaymentStatus = async (req: Request, res: Response) => {
  const { referenceId } = req.params;
  if (!referenceId) {
    return res.status(400).json({ success: false, message: "referenceId is required" });
  }
  try {
    const result = await mtnGetPaymentStatus(referenceId);
    return res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getMtnBalance = async (_req: Request, res: Response) => {
  try {
    const result = await mtnGetAccountBalance();
    return res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
