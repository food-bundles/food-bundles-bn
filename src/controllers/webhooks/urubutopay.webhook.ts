import { Request, Response } from "express";
import prisma from "../../prisma";
import { retryDatabaseOperation } from "../../utils/db-retry.utls";
import { PaymentStatus, OrderStatus } from "@prisma/client";
import { createNotificationService } from "../../services/notification.services";
import { sendPaymentConfirmationEmail, sendPaymentFailedEmail } from "../../utils/emails";
import { sendMessage } from "../../utils/sms.utility";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UrubutopayPaymentCallback {
  callback_type: "PAYMENT";
  status: number;
  transaction_status: "SUCCESSFUL" | "FAILED" | "PENDING";
  merchant_code: string;
  payer_code: string;
  payment_purpose?: string;
  payment_purpose_code?: string;
  payment_channel: string;
  payment_channel_name: string;
  amount: number;
  currency: string;
  payment_date_time: string;
  observation?: string;
  commission_amount?: number;
  internal_transaction_id: string;
  transaction_id?: string;
  reason?: string;
  slip_number?: string;
  bank_name?: string;
  bank_account?: string;
  bank_settlement_date?: string;
}

interface UrubutopayRecurringCallback {
  callback_type: "RECURRING";
  token: string;
  merchant_code: string;
  payer_code: string;
  payer_names?: string;
  service_code: string;
  amount: number;
  currency: string;
  payment_channel: string;
  payment_channel_name: string;
  next_payment_date: string;
  expires_at: string;
  payer_phone_number?: string;
  interval_unit: string;
  cycle_count: number;
}

interface UrubutopayInvoiceCallback {
  callback_type: "INVOICE";
  invoice_number: string;
  status: "PAID" | "FAILED" | "UNPAID";
  amount: number;
  currency: string;
  payer_names: string;
  payer_phone_number?: string;
  allow_custom_amount?: boolean;
  created_at: string;
  merchant_code: string;
  service_code: string;
}

interface UrubutopayDisbursementDebitCallback {
  callback_type: "BULK_DISBURSEMENT_DEBIT";
  source_payment_channel: string;
  destination_payment_channel: string;
  amount: number;
  currency: string;
  transaction_date: string;
  transaction_status: string;
  disbursement_status: string;
  internal_transaction_ref_number: string;
  external_transaction_ref_number: string;
  confirmation_status: string;
  source_of_funds: string;
}

interface UrubutopayTransferCallback {
  callback_type: "BULK_DISBURSEMENT_PAYMENT";
  internal_transaction_ref_number: string;
  transaction_date: string;
  transaction_status: "SUCCESSFUL" | "FAILED" | "PENDING" | "INITIATED";
  amount: number;
  currency: string;
  beneficiary_names: string;
  beneficiary_phone_number: string;
  beneficiary_code?: string;
  source_payment_channel: string;
  destination_payment_channel: string;
}

type UrubutopayCallbackPayload =
  | UrubutopayPaymentCallback
  | UrubutopayRecurringCallback
  | UrubutopayInvoiceCallback
  | UrubutopayDisbursementDebitCallback
  | UrubutopayTransferCallback;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validateBearerToken(req: Request): boolean {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7);
  return token === process.env.URUBUTOPAY_WEBHOOK_TOKEN;
}

function timestamp(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

// ─── Payment callback ─────────────────────────────────────────────────────────

async function handlePaymentCallback(payload: UrubutopayPaymentCallback) {
  const { transaction_id, internal_transaction_id, transaction_status, amount } = payload;

  const order = await retryDatabaseOperation(() =>
    prisma.order.findFirst({
      where: {
        OR: [
          { txRef: transaction_id },
          { txRef: internal_transaction_id },
          { paymentReference: transaction_id },
          { paymentReference: internal_transaction_id },
        ],
      },
      include: {
        restaurant: { select: { id: true, name: true, email: true, phone: true } },
        orderItems: true,
      },
    })
  );

  if (!order) {
    console.log("UrubutoPay webhook: no matching order for", transaction_id);
    return;
  }

  const isSuccess = transaction_status === "SUCCESSFUL";
  const isFailed = transaction_status === "FAILED";

  if (isSuccess && order.paymentStatus !== "COMPLETED") {
    await retryDatabaseOperation(() =>
      prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: PaymentStatus.COMPLETED,
          status: OrderStatus.CONFIRMED,
          transactionId: internal_transaction_id,
          paymentReference: transaction_id || internal_transaction_id,
          flwRef: internal_transaction_id,
          flwStatus: "successful",
          paidAt: new Date(),
        },
      })
    );

    try {
      await sendPaymentConfirmationEmail({
        amount: order.totalAmount,
        transactionId: internal_transaction_id,
        restaurantName: order.restaurant.name,
        products: order.orderItems.map((i) => ({
          name: i.productName,
          quantity: i.quantity,
          price: i.unitPrice,
        })),
        customer: {
          name: order.billingName || order.restaurant.name,
          email: order.billingEmail || order.restaurant.email || "",
        },
        orderId: order.id,
        orderNumber: order.orderNumber,
      });
    } catch (e) {
      console.error("UrubutoPay webhook: email error", e);
    }

    try {
      const phone = order.billingPhone || order.restaurant.phone;
      if (phone) {
        await sendMessage(
          `Your payment of ${order.totalAmount.toLocaleString()} RWF for order ${order.orderNumber} was successful.`,
          phone
        );
      }
    } catch (e) {
      console.error("UrubutoPay webhook: SMS error", e);
    }

    await createNotificationService({
      title: "Payment Successful",
      message: `Payment of ${order.totalAmount} RWF for order #${order.orderNumber} confirmed via UrubutoPay`,
      eventType: "PAYMENT_PROCESSED",
      targetType: "SPECIFIC_USER",
      targetId: order.restaurantId,
      metadata: { orderId: order.id, transactionId: internal_transaction_id },
    }).catch(console.error);
  } else if (isFailed && order.paymentStatus !== "FAILED") {
    await retryDatabaseOperation(() =>
      prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: PaymentStatus.FAILED,
          status: OrderStatus.CANCELLED,
          flwStatus: "failed",
        },
      })
    );

    try {
      await sendPaymentFailedEmail({
        amount: order.totalAmount,
        transactionId: internal_transaction_id,
        restaurantName: order.restaurant.name,
        products: order.orderItems.map((i) => ({
          name: i.productName,
          quantity: i.quantity,
          price: i.unitPrice,
        })),
        customer: {
          name: order.billingName || order.restaurant.name,
          email: order.billingEmail || order.restaurant.email || "",
        },
        orderId: order.id,
        orderNumber: order.orderNumber,
        failureReason: payload.reason,
      });
    } catch (e) {
      console.error("UrubutoPay webhook: failed email error", e);
    }

    await createNotificationService({
      title: "Payment Failed",
      message: `Payment for order #${order.orderNumber} failed via UrubutoPay`,
      eventType: "PAYMENT_FAILED",
      targetType: "SPECIFIC_USER",
      targetId: order.restaurantId,
      metadata: { orderId: order.id, reason: payload.reason },
    }).catch(console.error);
  }
}

// ─── Invoice callback ─────────────────────────────────────────────────────────

async function handleInvoiceCallback(payload: UrubutopayInvoiceCallback) {
  console.log("UrubutoPay invoice callback:", payload.invoice_number, payload.status);
  // Merchants can extend this to update invoice records in their DB
}

// ─── Recurring callback ───────────────────────────────────────────────────────

async function handleRecurringCallback(payload: UrubutopayRecurringCallback) {
  console.log("UrubutoPay recurring callback:", payload.token, payload.cycle_count);
  // Merchants can extend this to update subscription records
}

// ─── Disbursement callbacks ───────────────────────────────────────────────────

async function handleDisbursementDebitCallback(payload: UrubutopayDisbursementDebitCallback) {
  console.log(
    "UrubutoPay disbursement debit:",
    payload.internal_transaction_ref_number,
    payload.disbursement_status
  );
}

async function handleTransferCallback(payload: UrubutopayTransferCallback) {
  console.log(
    "UrubutoPay transfer:",
    payload.internal_transaction_ref_number,
    payload.transaction_status
  );
}

// ─── Main webhook handler ─────────────────────────────────────────────────────

/**
 * POST /webhooks/urubutopay
 * Handles all UrubutoPay callback types.
 * UrubutoPay authenticates using a Bearer token obtained from your /auth/authenticate endpoint.
 */
export const handleUrubutopayWebhook = async (req: Request, res: Response) => {
  const payload = req.body as UrubutopayCallbackPayload;

  console.log("UrubutoPay webhook received:", JSON.stringify(payload, null, 2));

  // Validate Bearer token
  if (!validateBearerToken(req)) {
    return res.status(401).json({ status: 401, message: "Unauthorized" });
  }

  // Acknowledge immediately
  res.status(200).json({
    timestamp: timestamp(),
    status: 200,
    message: "Callback received successfully",
  });

  // Process asynchronously
  try {
    switch (payload.callback_type) {
      case "PAYMENT":
        await handlePaymentCallback(payload as UrubutopayPaymentCallback);
        break;
      case "INVOICE":
        await handleInvoiceCallback(payload as UrubutopayInvoiceCallback);
        break;
      case "RECURRING":
        await handleRecurringCallback(payload as UrubutopayRecurringCallback);
        break;
      case "BULK_DISBURSEMENT_DEBIT":
        await handleDisbursementDebitCallback(payload as UrubutopayDisbursementDebitCallback);
        break;
      case "BULK_DISBURSEMENT_PAYMENT":
        await handleTransferCallback(payload as UrubutopayTransferCallback);
        break;
      default:
        console.warn("UrubutoPay webhook: unknown callback_type", (payload as any).callback_type);
    }
  } catch (error) {
    console.error("UrubutoPay webhook processing error:", error);
  }
};

/**
 * POST /webhooks/urubutopay/auth
 * UrubutoPay calls this to obtain a Bearer token before sending callbacks.
 * Credentials are configured during onboarding.
 */
export const handleUrubutopayWebhookAuth = (req: Request, res: Response) => {
  const { user_name, password } = req.body;

  if (
    user_name !== process.env.URUBUTOPAY_WEBHOOK_USERNAME ||
    password !== process.env.URUBUTOPAY_WEBHOOK_PASSWORD
  ) {
    return res.status(401).json({
      timestamp: timestamp(),
      status: 401,
      message: "Invalid credentials",
    });
  }

  return res.status(200).json({
    timestamp: timestamp(),
    status: 200,
    message: "Successful",
    data: {
      token: `Bearer ${process.env.URUBUTOPAY_WEBHOOK_TOKEN}`,
    },
  });
};
