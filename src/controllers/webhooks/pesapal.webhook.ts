import { Request, Response } from "express";
import prisma from "../../prisma";
import { retryDatabaseOperation } from "../../utils/db-retry.utls";
import { PaymentStatus, OrderStatus } from "@prisma/client";
import { createNotificationService } from "../../services/notification.services";
import { sendPaymentConfirmationEmail, sendPaymentFailedEmail } from "../../utils/emails";
import { sendMessage } from "../../utils/sms.utility";
import { pesapalGetTransactionStatus } from "../../services/payment/pesapal-payment.service";

async function processIPN(
  orderTrackingId: string,
  orderMerchantReference: string,
  notificationType: string,
  res: Response
) {
  // Fetch actual status from PesaPal (IPN does not include status for security)
  const txStatus = await pesapalGetTransactionStatus(orderTrackingId);

  // status_code: 0=INVALID, 1=COMPLETED, 2=FAILED, 3=REVERSED
  const isSuccess = txStatus.status_code === 1;
  const isFailed = txStatus.status_code === 2 || txStatus.status_code === 3;

  const order = await retryDatabaseOperation(() =>
    prisma.order.findFirst({
      where: {
        OR: [
          { txRef: orderMerchantReference },
          { paymentReference: orderMerchantReference },
        ],
      },
      include: {
        restaurant: { select: { id: true, name: true, email: true, phone: true } },
        orderItems: true,
      },
    })
  );

  if (!order) {
    console.log("PesaPal IPN: no matching order for", orderMerchantReference);
    return res.status(200).json({
      orderNotificationType: notificationType,
      orderTrackingId,
      orderMerchantReference,
      status: 200,
    });
  }

  if (isSuccess && order.paymentStatus !== "COMPLETED") {
    await retryDatabaseOperation(() =>
      prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: PaymentStatus.COMPLETED,
          status: OrderStatus.CONFIRMED,
          transactionId: orderTrackingId,
          paymentReference: orderMerchantReference,
          flwRef: txStatus.confirmation_code || orderTrackingId,
          flwStatus: "successful",
          paidAt: new Date(),
        },
      })
    );

    try {
      await sendPaymentConfirmationEmail({
        amount: order.totalAmount,
        transactionId: orderTrackingId,
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
      console.error("PesaPal IPN: email error", e);
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
      console.error("PesaPal IPN: SMS error", e);
    }

    await createNotificationService({
      title: "Payment Successful",
      message: `Payment of ${order.totalAmount} RWF for order #${order.orderNumber} confirmed via PesaPal`,
      eventType: "PAYMENT_PROCESSED",
      targetType: "SPECIFIC_USER",
      targetId: order.restaurantId,
      metadata: { orderId: order.id, transactionId: orderTrackingId },
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
        transactionId: orderTrackingId,
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
        failureReason: txStatus.payment_status_description,
      });
    } catch (e) {
      console.error("PesaPal IPN: failed email error", e);
    }

    await createNotificationService({
      title: "Payment Failed",
      message: `Payment for order #${order.orderNumber} failed via PesaPal`,
      eventType: "PAYMENT_FAILED",
      targetType: "SPECIFIC_USER",
      targetId: order.restaurantId,
      metadata: { orderId: order.id, reason: txStatus.payment_status_description },
    }).catch(console.error);
  }

  return res.status(200).json({
    orderNotificationType: notificationType,
    orderTrackingId,
    orderMerchantReference,
    status: 200,
  });
}

/**
 * GET /webhooks/pesapal
 * PesaPal IPN via GET request
 */
export const handlePesapalIPNGet = async (req: Request, res: Response) => {
  const { OrderTrackingId, OrderMerchantReference, OrderNotificationType } = req.query as Record<string, string>;

  console.log("PesaPal IPN GET received:", req.query);

  if (!OrderTrackingId || !OrderMerchantReference) {
    return res.status(400).json({ error: "Missing required IPN parameters" });
  }

  try {
    await processIPN(OrderTrackingId, OrderMerchantReference, OrderNotificationType || "IPNCHANGE", res);
  } catch (error) {
    console.error("PesaPal IPN GET processing error:", error);
    res.status(200).json({
      orderNotificationType: OrderNotificationType,
      orderTrackingId: OrderTrackingId,
      orderMerchantReference: OrderMerchantReference,
      status: 500,
    });
  }
};

/**
 * POST /webhooks/pesapal
 * PesaPal IPN via POST request
 */
export const handlePesapalIPNPost = async (req: Request, res: Response) => {
  const { OrderTrackingId, OrderMerchantReference, OrderNotificationType } = req.body;

  console.log("PesaPal IPN POST received:", req.body);

  if (!OrderTrackingId || !OrderMerchantReference) {
    return res.status(400).json({ error: "Missing required IPN parameters" });
  }

  try {
    await processIPN(OrderTrackingId, OrderMerchantReference, OrderNotificationType || "IPNCHANGE", res);
  } catch (error) {
    console.error("PesaPal IPN POST processing error:", error);
    res.status(200).json({
      orderNotificationType: OrderNotificationType,
      orderTrackingId: OrderTrackingId,
      orderMerchantReference: OrderMerchantReference,
      status: 500,
    });
  }
};
