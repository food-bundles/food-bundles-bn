import { Request, Response } from "express";
import prisma from "../../prisma";
import { retryDatabaseOperation } from "../../utils/db-retry.utls";
import { PaymentStatus, OrderStatus } from "@prisma/client";
import { createNotificationService } from "../../services/notification.services";
import { sendPaymentConfirmationEmail, sendPaymentFailedEmail } from "../../utils/emails";
import { sendMessage } from "../../utils/sms.utility";

interface MtnMomoCallbackPayload {
  referenceId?: string;
  externalId?: string;
  status: "SUCCESSFUL" | "FAILED" | "PENDING";
  reason?: string;
  financialTransactionId?: string;
  amount?: string;
  currency?: string;
  payer?: {
    partyIdType: string;
    partyId: string;
  };
}

/**
 * POST /webhooks/mtn-momo
 * MTN MoMo sends this when a RequestToPay transaction resolves.
 */
export const handleMtnMomoWebhook = async (req: Request, res: Response) => {
  const payload = req.body as MtnMomoCallbackPayload;

  console.log("MTN MoMo webhook received:", JSON.stringify(payload, null, 2));

  // MTN MoMo expects a 200 response
  res.status(200).json({ message: "Webhook received" });

  const referenceId = payload.referenceId || payload.externalId;

  if (!referenceId) {
    console.error("MTN MoMo webhook: missing referenceId");
    return;
  }

  const { status, reason, financialTransactionId } = payload;

  try {
    const isSuccess = status === "SUCCESSFUL";
    const isFailed = status === "FAILED";

    const order = await retryDatabaseOperation(() =>
      prisma.order.findFirst({
        where: {
          OR: [
            { txRef: referenceId },
            { paymentReference: referenceId },
          ],
        },
        include: {
          restaurant: { select: { id: true, name: true, email: true, phone: true } },
          orderItems: true,
        },
      })
    );

    if (!order) {
      console.log("MTN MoMo webhook: no matching order for referenceId", referenceId);
      return;
    }

    if (isSuccess && order.paymentStatus !== "COMPLETED") {
      await retryDatabaseOperation(() =>
        prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: PaymentStatus.COMPLETED,
            status: OrderStatus.CONFIRMED,
            transactionId: financialTransactionId || referenceId,
            paymentReference: referenceId,
            flwRef: financialTransactionId || referenceId,
            flwStatus: "successful",
            paidAt: new Date(),
          },
        })
      );

      try {
        await sendPaymentConfirmationEmail({
          amount: order.totalAmount,
          transactionId: financialTransactionId || referenceId,
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
        console.error("MTN MoMo webhook: email error", e);
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
        console.error("MTN MoMo webhook: SMS error", e);
      }

      await createNotificationService({
        title: "Payment Successful",
        message: `Payment of ${order.totalAmount} RWF for order #${order.orderNumber} confirmed via MTN MoMo`,
        eventType: "PAYMENT_PROCESSED",
        targetType: "SPECIFIC_USER",
        targetId: order.restaurantId,
        metadata: { orderId: order.id, transactionId: financialTransactionId || referenceId },
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
          transactionId: referenceId,
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
          failureReason: reason,
        });
      } catch (e) {
        console.error("MTN MoMo webhook: failed email error", e);
      }

      await createNotificationService({
        title: "Payment Failed",
        message: `Payment for order #${order.orderNumber} failed via MTN MoMo. Reason: ${reason || "Unknown"}`,
        eventType: "PAYMENT_FAILED",
        targetType: "SPECIFIC_USER",
        targetId: order.restaurantId,
        metadata: { orderId: order.id, reason },
      }).catch(console.error);
    }
  } catch (error) {
    console.error("MTN MoMo webhook processing error:", error);
  }
};
