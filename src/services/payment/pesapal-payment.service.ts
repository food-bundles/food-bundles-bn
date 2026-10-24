import axios from "axios";

const IS_SANDBOX = process.env.NODE_ENV !== "production";

const BASE_URL = IS_SANDBOX
  ? "https://cybqa.pesapal.com/pesapalv3"
  : "https://pay.pesapal.com/v3";

let cachedToken: string | null = null;
let tokenExpiry: Date | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && tokenExpiry && new Date() < tokenExpiry) {
    return cachedToken;
  }

  const { data } = await axios.post(
    `${BASE_URL}/api/Auth/RequestToken`,
    {
      consumer_key: process.env.PESAPAL_CONSUMER_KEY!,
      consumer_secret: process.env.PESAPAL_CONSUMER_SECRET!,
    },
    { headers: { Accept: "application/json", "Content-Type": "application/json" } }
  );

  if (data.error) throw new Error(data.error.message || "PesaPal auth failed");

  cachedToken = data.token;
  tokenExpiry = new Date(data.expiryDate);
  return cachedToken!;
}

function authHeaders(token: string) {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export interface PesapalBillingAddress {
  phone_number?: string;
  email_address?: string;
  country_code?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  line_1?: string;
  line_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  zip_code?: string;
}

export interface PesapalOrderRequest {
  id: string;
  currency: string;
  amount: number;
  description: string;
  callback_url: string;
  notification_id: string;
  cancellation_url?: string;
  redirect_mode?: string;
  branch?: string;
  billing_address: PesapalBillingAddress;
  account_number?: string;
  subscription_details?: {
    start_date: string;
    end_date: string;
    frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  };
}

export interface PesapalOrderResponse {
  order_tracking_id: string;
  merchant_reference: string;
  redirect_url: string;
  error: null | object;
  status: string;
}

export interface PesapalTransactionStatus {
  payment_method: string;
  amount: number;
  created_date: string;
  confirmation_code: string;
  payment_status_description: string;
  description: string;
  message: string;
  payment_account: string;
  call_back_url: string;
  status_code: number;
  merchant_reference: string;
  currency: string;
  error: null | object;
  status: string;
}

/**
 * Register an IPN URL and return its ipn_id
 */
export async function pesapalRegisterIPN(
  url: string,
  ipn_notification_type: "GET" | "POST" = "POST"
): Promise<{ ipn_id: string; url: string; ipn_status_description: string }> {
  const token = await getAccessToken();
  const { data } = await axios.post(
    `${BASE_URL}/api/URLSetup/RegisterIPN`,
    { url, ipn_notification_type },
    { headers: authHeaders(token) }
  );
  return data;
}

/**
 * Get all registered IPN URLs
 */
export async function pesapalGetIPNList(): Promise<any[]> {
  const token = await getAccessToken();
  const { data } = await axios.get(`${BASE_URL}/api/URLSetup/GetIpnList`, {
    headers: authHeaders(token),
  });
  return data;
}

/**
 * Submit an order and get a redirect URL for the customer
 */
export async function pesapalSubmitOrder(
  order: PesapalOrderRequest
): Promise<PesapalOrderResponse> {
  const token = await getAccessToken();
  const { data } = await axios.post(
    `${BASE_URL}/api/Transactions/SubmitOrderRequest`,
    order,
    { headers: authHeaders(token) }
  );

  if (data.error) throw new Error(JSON.stringify(data.error));
  return data;
}

/**
 * Get transaction status by orderTrackingId
 */
export async function pesapalGetTransactionStatus(
  orderTrackingId: string
): Promise<PesapalTransactionStatus> {
  const token = await getAccessToken();
  const { data } = await axios.get(
    `${BASE_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
    { headers: authHeaders(token) }
  );
  return data;
}

/**
 * Request a refund for a completed payment
 */
export async function pesapalRequestRefund({
  confirmation_code,
  amount,
  username,
  remarks,
}: {
  confirmation_code: string;
  amount: number;
  username: string;
  remarks: string;
}): Promise<{ status: string; message: string }> {
  const token = await getAccessToken();
  const { data } = await axios.post(
    `${BASE_URL}/api/Transactions/RefundRequest`,
    { confirmation_code, amount: String(amount), username, remarks },
    { headers: authHeaders(token) }
  );
  return data;
}

/**
 * Cancel a pending/failed order
 */
export async function pesapalCancelOrder(
  order_tracking_id: string
): Promise<{ status: string; message: string }> {
  const token = await getAccessToken();
  const { data } = await axios.post(
    `${BASE_URL}/api/Transactions/CancelOrder`,
    { order_tracking_id },
    { headers: authHeaders(token) }
  );
  return data;
}
