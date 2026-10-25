import axios, { AxiosInstance } from "axios";
import { v4 as uuidv4 } from "uuid";

const BASE_URL = "https://proxy.momoapi.mtn.co.rw";

export interface MtnPaymentResult {
  success: boolean;
  referenceId: string;
  status: "PENDING" | "SUCCESSFUL" | "FAILED";
  message: string;
  error?: string;
}

export interface MtnPaymentStatusResult {
  referenceId: string;
  status: "PENDING" | "SUCCESSFUL" | "FAILED";
  amount?: string;
  currency?: string;
  financialTransactionId?: string;
  reason?: string;
}

let cachedToken: string | null = null;
let tokenExpiry: Date | null = null;

function getClient(): AxiosInstance {
  return axios.create({
    baseURL: BASE_URL,
    timeout: 30000,
    headers: {
      "Content-Type": "application/json",
      "Ocp-Apim-Subscription-Key": process.env.MTN_MOMO_COLLECTION_PRIMARY_KEY!,
    },
  });
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && tokenExpiry && new Date() < tokenExpiry) {
    return cachedToken;
  }

  const apiUser = process.env.MTN_MOMO_REFERENCE_ID!;
  const apiKey = process.env.MTN_MOMO_API_KEY!;
  const credentials = Buffer.from(`${apiUser}:${apiKey}`).toString("base64");

  const { data } = await getClient().post(
    "/collection/token/",
    {},
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        "Ocp-Apim-Subscription-Key": process.env.MTN_MOMO_COLLECTION_PRIMARY_KEY!,
      },
    }
  );

  cachedToken = data.access_token;
  tokenExpiry = new Date(Date.now() + (data.expires_in - 300) * 1000);
  return cachedToken!;
}

export function formatMtnPhone(raw: string): string {
  const cleaned = raw.replace(/[\s\-()+]/g, "");
  if (cleaned.startsWith("250")) return cleaned;
  if (cleaned.startsWith("0")) return "250" + cleaned.slice(1);
  if (cleaned.length === 9) return "250" + cleaned;
  return cleaned;
}

export function isValidMtnPhone(phone: string): boolean {
  return /^250(78|79)\d{7}$/.test(formatMtnPhone(phone));
}

/**
 * Initiate a RequestToPay (C2B collection) — sends USSD push to customer
 */
export async function mtnRequestToPay({
  amount,
  phoneNumber,
  externalId,
  payerMessage,
  payeeNote,
  callbackUrl,
}: {
  amount: number;
  phoneNumber: string;
  externalId: string;
  payerMessage: string;
  payeeNote: string;
  callbackUrl?: string;
}): Promise<MtnPaymentResult> {
  const referenceId = uuidv4();
  const phone = formatMtnPhone(phoneNumber);
  const environment = process.env.MTN_MOMO_ENVIRONMENT || "mtnrwanda";

  try {
    const token = await getAccessToken();

    await getClient().post(
      "/collection/v1_0/requesttopay",
      {
        amount: String(Math.round(amount)),
        currency: process.env.MTN_MOMO_CURRENCY || "RWF",
        externalId,
        payer: { partyIdType: "MSISDN", partyId: phone },
        payerMessage,
        payeeNote,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Reference-Id": referenceId,
          "X-Target-Environment": environment,
          "X-Callback-Url": callbackUrl || process.env.MTN_MOMO_CALLBACK_URL || "",
          "Ocp-Apim-Subscription-Key": process.env.MTN_MOMO_COLLECTION_PRIMARY_KEY!,
        },
      }
    );

    return {
      success: true,
      referenceId,
      status: "PENDING",
      message: "Payment request sent. Please approve on your phone.",
    };
  } catch (error: any) {
    const msg = error.response?.data?.message || error.message;
    return { success: false, referenceId, status: "FAILED", message: msg, error: msg };
  }
}

/**
 * Get the status of a RequestToPay transaction
 */
export async function mtnGetPaymentStatus(
  referenceId: string
): Promise<MtnPaymentStatusResult> {
  const token = await getAccessToken();
  const environment = process.env.MTN_MOMO_ENVIRONMENT || "mtnrwanda";

  const { data } = await getClient().get(
    `/collection/v1_0/requesttopay/${referenceId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Target-Environment": environment,
        "Ocp-Apim-Subscription-Key": process.env.MTN_MOMO_COLLECTION_PRIMARY_KEY!,
      },
    }
  );

  return { ...data, referenceId };
}

/**
 * Get collection account balance
 */
export async function mtnGetAccountBalance(): Promise<{
  availableBalance: string;
  currency: string;
}> {
  const token = await getAccessToken();
  const environment = process.env.MTN_MOMO_ENVIRONMENT || "mtnrwanda";

  const { data } = await getClient().get("/collection/v1_0/account/balance", {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Target-Environment": environment,
      "Ocp-Apim-Subscription-Key": process.env.MTN_MOMO_COLLECTION_PRIMARY_KEY!,
    },
  });

  return data;
}
