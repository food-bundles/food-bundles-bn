import { Request, Response } from "express";
import {
  urubutopayInitiatePayment,
  urubutopayGetTransactionStatus,
  urubutopayValidateWallet,
  urubutopayGetKYC,
  urubutopayCreateInvoice,
  urubutopayGetInvoiceStatus,
  urubutopayGetWalletBalance,
  urubutopayInitiateDisbursement,
} from "../../services/payment/urubutopay-payment.service";

export const initiateUrubutopayPayment = async (req: Request, res: Response) => {
  const { service_code, payer_code, payer_names, payer_email, amount, channel_name, phone_number, transaction_id } = req.body;
  if (!service_code || !payer_code || !payer_names || !payer_email || !amount || !channel_name || !phone_number || !transaction_id) {
    return res.status(400).json({ success: false, message: "service_code, payer_code, payer_names, payer_email, amount, channel_name, phone_number, and transaction_id are required" });
  }
  try {
    const result = await urubutopayInitiatePayment(req.body);
    return res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getUrubutopayTransactionStatus = async (req: Request, res: Response) => {
  const { transaction_id } = req.params;
  if (!transaction_id) {
    return res.status(400).json({ success: false, message: "transaction_id is required" });
  }
  try {
    const result = await urubutopayGetTransactionStatus(transaction_id);
    return res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const validateUrubutopayWallet = async (req: Request, res: Response) => {
  const { payer_phone_number, payment_channel_name } = req.body;
  if (!payer_phone_number || !payment_channel_name) {
    return res.status(400).json({ success: false, message: "payer_phone_number and payment_channel_name are required" });
  }
  try {
    const result = await urubutopayValidateWallet(payer_phone_number, payment_channel_name);
    return res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getUrubutopayKYC = async (req: Request, res: Response) => {
  const { payer_phone_number, payment_channel_name } = req.body;
  if (!payer_phone_number || !payment_channel_name) {
    return res.status(400).json({ success: false, message: "payer_phone_number and payment_channel_name are required" });
  }
  try {
    const result = await urubutopayGetKYC(payer_phone_number, payment_channel_name);
    return res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createUrubutopayInvoice = async (req: Request, res: Response) => {
  const { service_code, payer_phone_number, amount, allow_custom_amount } = req.body;
  if (!service_code || !payer_phone_number || !amount || allow_custom_amount === undefined) {
    return res.status(400).json({ success: false, message: "service_code, payer_phone_number, amount, and allow_custom_amount are required" });
  }
  try {
    const result = await urubutopayCreateInvoice(req.body);
    return res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getUrubutopayInvoiceStatus = async (req: Request, res: Response) => {
  const { invoice_number } = req.params;
  if (!invoice_number) {
    return res.status(400).json({ success: false, message: "invoice_number is required" });
  }
  try {
    const result = await urubutopayGetInvoiceStatus(invoice_number);
    return res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getUrubutopayWalletBalance = async (_req: Request, res: Response) => {
  try {
    const result = await urubutopayGetWalletBalance();
    return res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const initiateUrubutopayDisbursement = async (req: Request, res: Response) => {
  const { source_of_funds, source_payment_channel, destination_payment_channel, external_transaction_ref_number, beneficiary_to_be_charged, beneficiaries } = req.body;
  if (!source_of_funds || !source_payment_channel || !destination_payment_channel || !external_transaction_ref_number || !beneficiary_to_be_charged || !beneficiaries?.length) {
    return res.status(400).json({ success: false, message: "source_of_funds, source_payment_channel, destination_payment_channel, external_transaction_ref_number, beneficiary_to_be_charged, and beneficiaries are required" });
  }
  try {
    const result = await urubutopayInitiateDisbursement(req.body);
    return res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
