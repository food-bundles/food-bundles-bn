import { Request, Response } from "express";
import {
  intouchRequestPayment,
  intouchRequestDeposit,
  intouchGetBalance,
  intouchGetTransactionStatus,
} from "../../services/payment/intouch-payment.service";

export const requestIntouchPayment = async (req: Request, res: Response) => {
  const { amount, mobilephone, requesttransactionid, callbackurl } = req.body;
  if (!amount || !mobilephone || !requesttransactionid) {
    return res.status(400).json({ success: false, message: "amount, mobilephone, and requesttransactionid are required" });
  }
  const result = await intouchRequestPayment({ amount, mobilephone, requesttransactionid, callbackurl });
  return res.status(result.success ? 200 : 400).json(result);
};

export const requestIntouchDeposit = async (req: Request, res: Response) => {
  const { amount, mobilephone, requesttransactionid, reason, callbackurl, withdrawcharge, sid } = req.body;
  if (!amount || !mobilephone || !requesttransactionid || !reason) {
    return res.status(400).json({ success: false, message: "amount, mobilephone, requesttransactionid, and reason are required" });
  }
  const result = await intouchRequestDeposit({ amount, mobilephone, requesttransactionid, reason, callbackurl, withdrawcharge, sid });
  return res.status(result.success ? 200 : 400).json(result);
};

export const getIntouchBalance = async (_req: Request, res: Response) => {
  const result = await intouchGetBalance();
  return res.status(result.success ? 200 : 500).json(result);
};

export const getIntouchTransactionStatus = async (req: Request, res: Response) => {
  const { requesttransactionid, transactionid } = req.body;
  if (!requesttransactionid || !transactionid) {
    return res.status(400).json({ success: false, message: "requesttransactionid and transactionid are required" });
  }
  const result = await intouchGetTransactionStatus({ requesttransactionid, transactionid });
  return res.status(result.success ? 200 : 400).json(result);
};
