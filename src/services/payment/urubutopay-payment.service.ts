import axios, { AxiosInstance } from "axios";

const BASE_URL =
  process.env.NODE_ENV === "production"
    ? "https://urubutopay.rw/api/v2"
    : "https://staging.urubutopay.rw/api/v2";

function getClient(): AxiosInstance {
  return axios.create({
    baseURL: BASE_URL,
    timeout: 30000,
    headers: {
      "Content-Type": "application/json",
      Authorization: process.env.URUBUTOPAY_API_KEY!,
    },
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UrubutopayInitiatePaymentRequest {
  merchant_code?: string;
  service_code: string;
  payer_code: string;
  payer_names: string;
  payer_email: string;
  amount: number;
  channel_name: "MOMO" | "AIRTEL_MONEY" | "CARD";
  phone_number: string;
  transaction_id: string;
  redirection_url?: string;
  recurring?: {
    enabled: boolean;
    interval_unit: "DAY" | "MONTH" | "YEAR";
    expires_at: string;
    automation_mode: "PLATFORM" | "MERCHANT";
  };
}

export interface UrubutopayPaymentResponse {
  timestamp: string;
  status: number;
  message: string;
  data: {
    internal_transaction_ref_number: string;
    external_transaction_ref_number: string;
    currency: string;
    paid_mount: number;
    payer_phone_number: string;
    payment_channel: string;
    payment_channel_name: string;
    card_processing_url?: string;
  };
}

export interface UrubutopayTransactionStatusResponse {
  timestamp: string;
  status: number;
  data: {
    transaction_status: "INITIATED" | "PENDING" | "VALID" | "FAILED" | "PENDING_SETTLEMENT";
    payer_code: string;
    payment_channel: string;
    payment_channel_name: string;
    currency: string;
    merchant_code: string;
    payer_names: string;
    payer_email: string;
    service_code: string;
    transaction_id: string;
    internal_transaction_id: string;
    amount: number;
    phone_number: string;
    payment_date_time: string;
  };
}

export interface UrubutopayCreateInvoiceRequest {
  merchant_code?: string;
  service_code: string;
  payer_phone_number: string;
  amount: number;
  currency?: string;
  allow_custom_amount: boolean;
}

export interface UrubutopayBeneficiary {
  beneficiary_names: string;
  beneficiary_phone_number: string;
  amount: number;
  beneficiary_code: string;
  description?: string;
}

export interface UrubutopayInitiateDisbursementRequest {
  source_of_funds: string;
  source_payment_channel: "MERCHANT_WALLET" | "MOMO" | "AIRTEL_MONEY";
  destination_payment_channel: "MOMO" | "AIRTEL_MONEY" | "EKASH" | "BK";
  external_transaction_ref_number: string;
  beneficiary_to_be_charged: "YES" | "NO";
  wallet_account_id?: string;
  beneficiaries: UrubutopayBeneficiary[];
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export async function urubutopayInitiatePayment(
  payload: UrubutopayInitiatePaymentRequest
): Promise<UrubutopayPaymentResponse> {
  const { data } = await getClient().post("/payment/initiate", {
    ...payload,
    merchant_code: payload.merchant_code || process.env.URUBUTOPAY_MERCHANT_CODE,
  });
  return data;
}

export async function urubutopayGetTransactionStatus(
  transaction_id: string,
  merchant_code?: string
): Promise<UrubutopayTransactionStatusResponse> {
  const { data } = await getClient().post("/payment/transaction/status", {
    merchant_code: merchant_code || process.env.URUBUTOPAY_MERCHANT_CODE,
    transaction_id,
  });
  return data;
}

export async function urubutopayValidateWallet(
  payer_phone_number: string,
  payment_channel_name: "MOMO" | "AIRTEL_MONEY"
): Promise<{ valid: boolean }> {
  const { data } = await getClient().post("/payment/account-holder/validate", {
    payer_phone_number,
    payment_channel_name,
  });
  return data;
}

export async function urubutopayGetKYC(
  payer_phone_number: string,
  payment_channel_name: "MOMO" | "AIRTEL_MONEY" | "BK"
): Promise<{ timestamp: string; status: number; data: { given_name: string; family_name: string } }> {
  const { data } = await getClient().post("/payment/account-holder/detail", {
    payer_phone_number,
    payment_channel_name,
  });
  return data;
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

export async function urubutopayCreateInvoice(payload: UrubutopayCreateInvoiceRequest) {
  const { data } = await getClient().post("/invoice/create", {
    ...payload,
    merchant_code: payload.merchant_code || process.env.URUBUTOPAY_MERCHANT_CODE,
    currency: payload.currency || "RWF",
  });
  return data;
}

export async function urubutopayGetInvoiceStatus(invoice_number: string) {
  const { data } = await getClient().post("/invoice/status", { invoice_number });
  return data;
}

export async function urubutopayValidateInvoice(invoice_number: string) {
  const { data } = await getClient().post("/invoice/validate", { invoice_number });
  return data;
}

// ─── Recurring ────────────────────────────────────────────────────────────────

export async function urubutopayExecuteRecurring(
  recurring_token: string,
  transaction_id: string,
  metadata?: Record<string, unknown>
) {
  const { data } = await getClient().post("/recurring-payment/execute", {
    recurring_token,
    transaction_id,
    metadata,
  });
  return data;
}

export async function urubutopayGetRecurringStatus(recurring_token: string) {
  const { data } = await getClient().post("/recurring-payment/status", { recurring_token });
  return data;
}

export async function urubutopayStopRecurring(recurring_token: string) {
  const { data } = await getClient().post("/recurring-payment/cancel", { recurring_token });
  return data;
}

// ─── Wallet ───────────────────────────────────────────────────────────────────

export async function urubutopayGetWalletBalance(wallet_account_id?: string) {
  const { data } = await getClient().post("/wallet/balance", {
    ...(wallet_account_id ? { wallet_account_id } : {}),
  });
  return data;
}

// ─── Bulk Disbursement ────────────────────────────────────────────────────────

export async function urubutopayInitiateDisbursement(
  payload: UrubutopayInitiateDisbursementRequest
) {
  const { data } = await getClient().post("/bulk-disbursement/initiate", payload);
  return data;
}

export async function urubutopayCheckDisbursementStatus(
  internal_transaction_ref_number: string
) {
  const { data } = await getClient().post("/bulk-disbursement/check-transaction", {
    internal_transaction_ref_number,
  });
  return data;
}

export async function urubutopayCheckTransferStatus(
  internal_transaction_ref_number: string,
  beneficiary_code: string
) {
  const { data } = await getClient().post("/bulk-disbursement/check-transfer", {
    internal_transaction_ref_number,
    beneficiary_code,
  });
  return data;
}
