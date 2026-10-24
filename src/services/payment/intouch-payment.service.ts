import crypto from "crypto";
import axios from "axios";

const IS_SANDBOX = process.env.NODE_ENV !== "production";

const BASE_URL = IS_SANDBOX
  ? "https://developer.intouchpay.co.rw/api/v1/sandbox"
  : "https://www.intouchpay.co.rw/api";

function getTimestamp(): string {
  return new Date()
    .toISOString()
    .replace(/[-T:.Z]/g, "")
    .slice(0, 14);
}

function hashPassword(timestamp: string): string {
  const username = process.env.INTOUCH_USERNAME!;
  const accountNo = process.env.INTOUCH_ACCOUNT_NO!;
  const partnerPassword = process.env.INTOUCH_PARTNER_PASSWORD!;
  const raw = `${username}${accountNo}${partnerPassword}${timestamp}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function buildAuthFields() {
  const timestamp = getTimestamp();
  return {
    username: process.env.INTOUCH_USERNAME!,
    accountno: process.env.INTOUCH_ACCOUNT_NO!,
    timestamp,
    password: hashPassword(timestamp),
  };
}

export interface IntouchPaymentResult {
  success: boolean;
  status: string;
  transactionId?: string;
  requestTransactionId?: string;
  responsecode?: string;
  message: string;
  provider?: { code: string; name: string };
  error?: string;
}

export interface IntouchDepositResult extends IntouchPaymentResult {
  referenceid?: string;
  referenceno?: string;
}

export interface IntouchBalanceResult {
  success: boolean;
  balance?: number;
  currency?: string;
  error?: string;
}

export interface IntouchTransactionStatusResult {
  success: boolean;
  status?: string;
  responsecode?: string;
  message?: string;
  error?: string;
}

/**
 * Request a C2B payment (pull from customer mobile money)
 */
export async function intouchRequestPayment({
  amount,
  mobilephone,
  requesttransactionid,
  callbackurl,
}: {
  amount: number;
  mobilephone: string;
  requesttransactionid: string;
  callbackurl?: string;
}): Promise<IntouchPaymentResult> {
  const auth = buildAuthFields();
  const payload = {
    ...auth,
    amount,
    mobilephone,
    requesttransactionid,
    callbackurl: callbackurl || process.env.INTOUCH_CALLBACK_URL,
  };

  try {
    const { data } = await axios.post(`${BASE_URL}/requestpayment/`, payload, {
      headers: { "Content-Type": "application/json" },
    });

    return {
      success: data.success ?? data.responsecode === "1000",
      status: data.status || "Pending",
      transactionId: data.transactionid,
      requestTransactionId: data.requesttransactionid,
      responsecode: data.responsecode,
      message: data.message || "Payment request initiated",
      provider: data.provider,
    };
  } catch (error: any) {
    const msg = error.response?.data?.message || error.message;
    return { success: false, status: "failed", message: msg, error: msg };
  }
}

/**
 * Send a B2C deposit (push to customer mobile money wallet)
 */
export async function intouchRequestDeposit({
  amount,
  mobilephone,
  requesttransactionid,
  reason,
  callbackurl,
  withdrawcharge = 1,
  sid = 1,
}: {
  amount: number;
  mobilephone: string;
  requesttransactionid: string;
  reason: string;
  callbackurl?: string;
  withdrawcharge?: number;
  sid?: number;
}): Promise<IntouchDepositResult> {
  const auth = buildAuthFields();
  const payload = {
    ...auth,
    amount,
    mobilephone,
    requesttransactionid,
    reason,
    callbackurl: callbackurl || process.env.INTOUCH_CALLBACK_URL,
    withdrawcharge,
    sid,
  };

  try {
    const { data } = await axios.post(`${BASE_URL}/requestdeposit/`, payload, {
      headers: { "Content-Type": "application/json" },
    });

    return {
      success: data.success ?? data.responsecode === "2001",
      status: data.status || data.statusdesc || "Successfull",
      transactionId: data.transactionid,
      requestTransactionId: data.requesttransactionid,
      responsecode: data.responsecode,
      referenceid: data.referenceid,
      referenceno: data.referenceno,
      message: data.statusdesc || "Deposit initiated",
      provider: data.provider,
    };
  } catch (error: any) {
    const msg = error.response?.data?.message || error.message;
    return { success: false, status: "failed", message: msg, error: msg };
  }
}

/**
 * Get account balance
 */
export async function intouchGetBalance(): Promise<IntouchBalanceResult> {
  const auth = buildAuthFields();

  try {
    const { data } = await axios.post(`${BASE_URL}/getbalance/`, auth, {
      headers: { "Content-Type": "application/json" },
    });

    return {
      success: data.success ?? true,
      balance: parseFloat(data.balance),
      currency: data.currency || "RWF",
    };
  } catch (error: any) {
    const msg = error.response?.data?.message || error.message;
    return { success: false, error: msg };
  }
}

/**
 * Get transaction status
 */
export async function intouchGetTransactionStatus({
  requesttransactionid,
  transactionid,
}: {
  requesttransactionid: string;
  transactionid: string;
}): Promise<IntouchTransactionStatusResult> {
  const auth = buildAuthFields();
  const payload = { ...auth, requesttransactionid, transactionid };

  try {
    const { data } = await axios.post(
      `${BASE_URL}/gettransactionstatus/`,
      payload,
      { headers: { "Content-Type": "application/json" } }
    );

    return {
      success: data.success ?? false,
      status: data.status,
      responsecode: data.responsecode,
      message: data.message,
    };
  } catch (error: any) {
    const msg = error.response?.data?.message || error.message;
    return { success: false, error: msg };
  }
}
