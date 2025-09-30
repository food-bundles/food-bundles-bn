import { Request, Response } from "express";
import crypto from "crypto";
import prisma from "../prisma";
import {
  sendPaymentConfirmationEmail,
  sendPaymentFailedEmail,
} from "../utils/emailTemplates";
import { sendMessage } from "../utils/sms.utility";
import { clearCartService } from "../services/cart.service";
import { retryDatabaseOperation } from "../utils/db-retry.utls";

// Shared function to process wallet transactions with retry logic
async function processWalletTransaction(
  txRef: string,
  flwRef: string,
  status: string,
  currency?: string
) {
  console.log("Processing wallet transaction for reference:", txRef);

  const walletTransaction = await retryDatabaseOperation(async () => {
    return await prisma.walletTransaction.findFirst({
      where: {
        OR: [
          { flwTxRef: txRef },
          { flwRef: txRef },
          { id: txRef },
          { flwTxRef: { contains: txRef.split("_").pop() || "" } },
        ],
      },
      include: {
        wallet: {
          include: { restaurant: true },
        },
      },
    });
  });

  if (!walletTransaction) {
    console.log("No matching wallet transaction found for txRef:", txRef);
    return null;
  }

  console.log("Found matching wallet transaction:", walletTransaction.id);

  if (status === "successful" && walletTransaction.status !== "COMPLETED") {
    const newBalance =
      walletTransaction.wallet.balance + walletTransaction.amount;

    await retryDatabaseOperation(async () => {
      return await prisma.$transaction([
        prisma.wallet.update({
          where: { id: walletTransaction.walletId },
          data: {
            balance: newBalance,
            updatedAt: new Date(),
          },
        }),
        prisma.walletTransaction.update({
          where: { id: walletTransaction.id },
          data: {
            status: "COMPLETED",
            newBalance,
            flwStatus: "successful",
            flwMessage: "Payment completed via webhook",
            externalTxId: flwRef,
            flwRef: flwRef,
            updatedAt: new Date(),
          },
        }),
      ]);
    });

    // Send notification
    try {
      await sendMessage(
        `Dear ${walletTransaction.wallet.restaurant.name}, Payment completed: ${walletTransaction.amount} ${walletTransaction.wallet.currency} for wallet Top-up. Thank you!`,
        walletTransaction.wallet.restaurant.phone || ""
      );
    } catch (error) {
      console.error("Failed to send wallet notification:", error);
    }

    console.log(
      `Wallet top-up completed: ${walletTransaction.amount} ${walletTransaction.wallet.currency} for wallet ${walletTransaction.walletId}`
    );
  } else if (status === "failed") {
    await retryDatabaseOperation(async () => {
      return await prisma.walletTransaction.update({
        where: { id: walletTransaction.id },
        data: {
          status: "FAILED",
          flwStatus: "failed",
          flwMessage: "Payment failed via webhook",
          externalTxId: flwRef,
          flwRef: flwRef,
          updatedAt: new Date(),
        },
      });
    });

    try {
      await sendMessage(
        `Dear ${walletTransaction.wallet.restaurant.name}, Payment failed: ${walletTransaction.amount} ${walletTransaction.wallet.currency} for wallet Top-up. Thank you!`,
        walletTransaction.wallet.restaurant.phone || ""
      );
    } catch (error) {
      console.error("Failed to send wallet failure notification:", error);
    }

    console.log(`Wallet top-up failed: ${walletTransaction.id}`);
  } else {
    console.log(
      `Transaction already processed or status unchanged: ${walletTransaction.status}`
    );
  }

  return walletTransaction;
}

// Shared function to process order payments with retry logic
async function processCheckoutPayment(
  txRef: string,
  flwRef: string,
  status: string,
  paymentProvider: "FLUTTERWAVE" | "PAYPACK" = "FLUTTERWAVE",
  eventType?: string,
  data?: any
) {
  const whereClause =
    paymentProvider === "PAYPACK"
      ? { paymentReference: txRef, paymentProvider: "PAYPACK" }
      : { OR: [{ txRef: txRef }, { paymentReference: txRef }] };

  const orderData = await retryDatabaseOperation(async () => {
    return await prisma.order.findFirst({
      where: whereClause,
      include: {
        restaurant: true,
        orderItems: true,
        cart: {
          include: {
            cartItems: {
              include: { product: true },
            },
          },
        },
      },
    });
  });

  if (!orderData) {
    console.log("No matching order found for txRef:", txRef);
    return null;
  }

  console.log("Found matching order:", orderData.id);

  if (status === "successful" && orderData.paymentStatus !== "COMPLETED") {
    const updateData: any = {
      paymentStatus: "COMPLETED",
      flwStatus: "successful",
      flwMessage: `Payment completed via ${paymentProvider.toLowerCase()} webhook`,
      transactionId: data?.id?.toString() || flwRef,
      flwRef: flwRef,
      paidAt: new Date(),
      updatedAt: new Date(),
    };

    if (paymentProvider === "FLUTTERWAVE") {
      updateData.appFee = data?.appfee;
      updateData.merchantFee = data?.merchantfee;
    } else if (paymentProvider === "PAYPACK") {
      updateData.appFee = data?.data?.fee;
    }

    await retryDatabaseOperation(async () => {
      return await prisma.order.update({
        where: { id: orderData.id },
        data: updateData,
      });
    });

    // Update existing order if it exists
    try {
      await retryDatabaseOperation(async () => {
        return await prisma.order.update({
          where: { id: orderData.id },
          data: {
            paymentStatus: "COMPLETED",
            status: "CONFIRMED",
            updatedAt: new Date(),
          },
        });
      });
    } catch (orderUpdateError) {
      console.error("Failed to update order status:", orderUpdateError);
    }

    // Clear cart if order is completed
    if (orderData.cartId && (orderData.cart?.cartItems?.length ?? 0) > 0) {
      try {
        await retryDatabaseOperation(async () => {
          return await clearCartService(orderData.cartId!);
        });
      } catch (clearCartError) {
        console.error("Failed to clear cart:", clearCartError);
      }
    }

    // Send notifications (these are not critical, so we don't retry them)
    try {
      await sendMessage(
        `Dear ${
          orderData.billingName || orderData.restaurant.name || ""
        }, Payment completed: ${orderData.totalAmount} ${
          orderData.currency
        }. Thank you!`,
        orderData.billingPhone || orderData.restaurant.phone || ""
      );
    } catch (smsError) {
      console.error("Failed to send SMS notification:", smsError);
    }

    try {
      await sendPaymentConfirmationEmail({
        amount: orderData.totalAmount,
        transactionId: data?.id?.toString() || flwRef,
        restaurantName: orderData.restaurant.name,
        products: orderData.orderItems.map((item) => ({
          name: item.productName,
          quantity: item.quantity,
          price: item.unitPrice,
        })),
        customer: {
          name: orderData.billingName || orderData.restaurant.name || "",
          email: orderData.billingEmail || orderData.restaurant.email || "",
        },
        orderId: orderData.id,
      });
    } catch (emailError) {
      console.error("Failed to send confirmation email:", emailError);
    }

    console.log(`Checkout payment completed: ${orderData.id}`);
  } else if (status === "failed") {
    await retryDatabaseOperation(async () => {
      return await prisma.order.update({
        where: { id: orderData.id },
        data: {
          paymentStatus: "FAILED",
          flwStatus: "failed",
          transactionId: data?.id?.toString() || flwRef,
          flwRef: flwRef,
          updatedAt: new Date(),
        },
      });
    });

    // Update order status to failed/cancelled
    try {
      await retryDatabaseOperation(async () => {
        return await prisma.order.update({
          where: { id: orderData.id },
          data: {
            paymentStatus: "FAILED",
            status: "CANCELLED",
            updatedAt: new Date(),
          },
        });
      });
    } catch (orderUpdateError) {
      console.error("Failed to update failed order status:", orderUpdateError);
    }

    try {
      await sendMessage(
        `Dear ${
          orderData.billingName || orderData.restaurant.name || ""
        }, Payment failed: ${orderData.totalAmount} ${
          orderData.currency
        }. Please try again.`,
        orderData.billingPhone || orderData.restaurant.phone || ""
      );
    } catch (smsError) {
      console.error("Failed to send failure SMS notification:", smsError);
    }

    try {
      await sendPaymentFailedEmail({
        amount: orderData.totalAmount,
        transactionId: data?.id?.toString() || flwRef,
        restaurantName: orderData.restaurant.name,
        products: orderData.orderItems.map((item) => ({
          name: item.productName,
          quantity: item.quantity,
          price: item.unitPrice,
        })),
        customer: {
          name: orderData.billingName || orderData.restaurant.name || "",
          email: orderData.billingEmail || orderData.restaurant.email || "",
        },
        orderId: orderData.id,
      });
    } catch (emailError) {
      console.error("Failed to send payment failed email:", emailError);
    }

    console.log(`Checkout payment failed: ${orderData.id}`);
  }

  return orderData;
}

// Helper function to detect payment provider based on request body structure
function detectPaymentProvider(body: any): "FLUTTERWAVE" | "PAYPACK" {
  // PayPack has nested structure with info?.data?.status and info.data?.ref
  if (body?.data?.status !== undefined && body?.data?.ref !== undefined) {
    return "PAYPACK";
  }

  // Flutterwave has flat structure with data.txRef, data["event.type"] and data.status
  if (
    body?.txRef !== undefined ||
    body?.tx_ref !== undefined ||
    body?.["event.type"] !== undefined ||
    body?.event !== undefined
  ) {
    return "FLUTTERWAVE";
  }

  // Default to Flutterwave if structure is unclear
  return "FLUTTERWAVE";
}

const handleChargeCompleted = async (data: any) => {
  try {
    console.log("Processing Flutterwave charge.completed webhook:", data);

    const txRef =
      data.tx_ref || data.txRef || data.data?.tx_ref || data.data?.txRef;
    const flwRef =
      data.flw_ref || data.flwRef || data.data?.flw_ref || data.data?.flwRef;
    const status = data.status || data.data?.status;
    const eventType = data["event.type"] || data.event;

    if (!txRef) {
      console.error("No transaction reference found in Flutterwave webhook");
      return;
    }

    console.log(
      `Processing transaction: txRef=${txRef}, flwRef=${flwRef}, status=${status}`
    );

    // Check if this is a wallet top-up transaction
    if (txRef && (txRef.includes("WALLET_TOPUP_") || txRef.startsWith("175"))) {
      await processWalletTransaction(txRef, flwRef, status, data.currency);
    } else {
      // Process as regular order payment
      await processCheckoutPayment(
        txRef,
        flwRef,
        status,
        "FLUTTERWAVE",
        eventType,
        data
      );
    }
  } catch (error: any) {
    console.error("Error processing charge.completed webhook:", error);
    throw error;
  }
};

export const handlePaymentWebhook = async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    const paymentProvider = detectPaymentProvider(payload);

    console.log(
      `${paymentProvider} Webhook received:`,
      JSON.stringify(payload, null, 2)
    );

    // Handle Flutterwave webhook
    if (paymentProvider === "FLUTTERWAVE") {
      // Verify webhook signature
      const secretHash = process.env.FLW_SECRET_HASH;
      const signature = req.headers["verif-hash"];

      if (!signature || signature !== secretHash) {
        return res.status(401).json({ error: "Unauthorized webhook" });
      }

      await handleChargeCompleted(payload);
    }
    // Handle PayPack webhook
    else if (paymentProvider === "PAYPACK") {
      // Verify PayPack webhook signature
      const paypackSignature = req.headers["x-paypack-signature"] as string;
      const paypackSecret = process.env.PAYPACK_WEBHOOK_SECRET;

      if (!paypackSecret) {
        return res.status(500).json({ error: "Webhook configuration error" });
      }

      if (!paypackSignature) {
        return res.status(401).json({ error: "Missing signature header" });
      }

      // Use raw body for signature verification
      let rawBody: string;

      // Check if we have access to raw body
      if ((req as any).rawBody) {
        rawBody = (req as any).rawBody;
      }
      // If raw body not available, convert payload back to string
      else {
        rawBody = JSON.stringify(payload);
      }

      const expectedSignature = crypto
        .createHmac("sha256", paypackSecret)
        .update(rawBody)
        .digest("base64");

      if (paypackSignature !== expectedSignature) {
        return res.status(401).json({ error: "Invalid webhook signature" });
      }

      const paymentStatus = payload?.data?.status;
      const txRef = payload.data?.ref;
      const flwRef = payload.data?.ref;

      if (!txRef) {
        console.error("No transaction reference found in PayPack webhook");
        return res
          .status(400)
          .json({ error: "No transaction reference provided" });
      }

      // Check if this is a wallet top-up transaction
      if (
        txRef &&
        (txRef.includes("WALLET_TOPUP_") || txRef.startsWith("175"))
      ) {
        await processWalletTransaction(txRef, flwRef, paymentStatus);
      } else {
        // Process as regular order payment
        await processCheckoutPayment(txRef, flwRef, paymentStatus, "PAYPACK");
      }
    }
    res.status(200).json({ message: "Webhook processed successfully" });
  } catch (error: any) {
    console.error("Payment webhook processing error:", error);

    // Check if it's a database connection issue
    if (error.message?.includes("timeout") || error.code === "P1017") {
      return res.status(503).json({
        error: "Service temporarily unavailable",
        message: "Database connection issue, webhook will be retried",
      });
    }

    res.status(500).json({ error: "Webhook processing failed" });
  }
};
