import { Request, Response } from "express";
import prisma from "../../prisma";
import { retryDatabaseOperation } from "../../utils/db-retry.utls";
import { PaymentStatus, OrderStatus } from "@prisma/client";
import { createNotificationService } from "../../services/notification.services";
import {
  sendPaymentConfirmationEmail,
  sendPaymentFailedEmail,
} from "../../utils/emails";
import { sendMessage } from "../../utils/sms.utility";

interface IntouchCallbackPayload {
  jsonpayload: {
    requesttransactionid: string;
    transactionid: string;
    status: string;
    responsecode: string;
    statusdesc: string;
    referenceno?: string;
    amount?: number;
    currency?: string;
    transactionfee?: number;
  };
}

/**
 * POST /webhooks/intouch
 * IntouchPay sends this after a payment resolves (approved/rejected/timeout).
 * Must respond with { message: "success", success: true, request_id: "..." }
 */
export const handleIntouchWebhook = async (req: Request, res: Response) => {
  console.log("Received InTouch Payment Webhook request", req);

  const body = req.body as IntouchCallbackPayload;

  console.log("InTouch webhook received:", JSON.stringify(body, null, 2));

  const payload = body?.jsonpayload;

  console.log("Received InTouch Payment Webhook payload", payload);

  if (!payload?.requesttransactionid) {
    return res.status(400).json({ message: "Missing requesttransactionid" });
  }

  const {
    requesttransactionid,
    transactionid,
    responsecode,
    status,
    statusdesc,
  } = payload;

  // Acknowledge immediately as required by InTouch
  res.status(200).json({
    message: "success",
    success: true,
    request_id: requesttransactionid,
  });

  // Process asynchronously after acknowledgement
  try {
    const isSuccess =
      responsecode === "01" || status?.toLowerCase() === "successfull";
    const isFailed = !isSuccess;

    const order = await retryDatabaseOperation(() =>
      prisma.order.findFirst({
        where: {
          OR: [
            { txRef: requesttransactionid },
            { paymentReference: requesttransactionid },
          ],
        },
        include: {
          restaurant: {
            select: { id: true, name: true, email: true, phone: true },
          },
          orderItems: true,
        },
      }),
    );

    if (!order) {
      console.log(
        "InTouch webhook: no matching order for",
        requesttransactionid,
      );
      return;
    }

    if (isSuccess && order.paymentStatus !== "COMPLETED") {
      await retryDatabaseOperation(() =>
        prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: PaymentStatus.COMPLETED,
            status: OrderStatus.CONFIRMED,
            transactionId: transactionid,
            paymentReference: requesttransactionid,
            flwRef: transactionid,
            flwStatus: "successful",
            paidAt: new Date(),
          },
        }),
      );

      try {
        await sendPaymentConfirmationEmail({
          amount: order.totalAmount,
          transactionId: transactionid,
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
        console.error("InTouch webhook: email error", e);
      }

      try {
        const phone = order.billingPhone || order.restaurant.phone;
        if (phone) {
          await sendMessage(
            `Your payment of ${order.totalAmount.toLocaleString()} RWF for order ${order.orderNumber} was successful.`,
            phone,
          );
        }
      } catch (e) {
        console.error("InTouch webhook: SMS error", e);
      }

      await createNotificationService({
        title: "Payment Successful",
        message: `Payment of ${order.totalAmount} RWF for order #${order.orderNumber} confirmed via InTouch`,
        eventType: "PAYMENT_PROCESSED",
        targetType: "SPECIFIC_USER",
        targetId: order.restaurantId,
        metadata: { orderId: order.id, transactionId: transactionid },
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
        }),
      );

      try {
        await sendPaymentFailedEmail({
          amount: order.totalAmount,
          transactionId: transactionid,
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
          failureReason: statusdesc,
        });
      } catch (e) {
        console.error("InTouch webhook: failed email error", e);
      }

      await createNotificationService({
        title: "Payment Failed",
        message: `Payment for order #${order.orderNumber} failed via InTouch`,
        eventType: "PAYMENT_FAILED",
        targetType: "SPECIFIC_USER",
        targetId: order.restaurantId,
        metadata: { orderId: order.id, reason: statusdesc },
      }).catch(console.error);
    }
  } catch (error) {
    console.error("InTouch webhook processing error:", error);
  }
};
