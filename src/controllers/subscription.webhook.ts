import { Request, Response } from "express";
import crypto from "crypto";
import prisma from "../prisma";
import { sendMessage } from "../utils/sms.utility";
import { retryDatabaseOperation } from "../utils/db-retry.utls";
import { wsManager } from "../index";

/**
 * Process subscription payment webhook
 */
async function processSubscriptionPayment(
  txRef: string,
  flwRef: string,
  status: string,
  paymentProvider: "FLUTTERWAVE" | "PAYPACK" = "FLUTTERWAVE",
  data?: any
) {
  console.log("Processing subscription payment for reference:", txRef);

  const subscription = await retryDatabaseOperation(async () => {
    return await prisma.restaurantSubscription.findFirst({
      where: {
        OR: [{ txRef: txRef }, { flwRef: txRef }],
      },
      include: {
        restaurant: true,
        plan: true,
      },
    });
  });

  if (!subscription) {
    console.log("No matching subscription found for txRef:", txRef);
    return null;
  }

  console.log("Found matching subscription:", subscription.id);

  if (status === "successful" && subscription.paymentStatus !== "COMPLETED") {
    const updateData: any = {
      paymentStatus: "COMPLETED",
      status: "ACTIVE",
      flwStatus: "successful",
      transactionId: data?.id?.toString() || flwRef,
      flwRef: flwRef,
      amountPaid: subscription.plan.price,
      updatedAt: new Date(),
    };

    if (paymentProvider === "FLUTTERWAVE") {
      updateData.appFee = data?.appfee || data?.data?.fee;
      updateData.merchantFee = data?.merchantfee || data?.data?.merchantfee;
    }

    // Update subscription and create history in transaction
    await retryDatabaseOperation(async () => {
      return await prisma.$transaction([
        prisma.restaurantSubscription.update({
          where: { id: subscription.id },
          data: updateData,
        }),
        prisma.subscriptionHistory.create({
          data: {
            subscriptionId: subscription.id,
            action: "CREATED",
            newStatus: "ACTIVE",
            newPlanId: subscription.planId,
            reason: "Payment completed successfully",
          },
        }),
      ]);
    });

    // Send success notification
    try {
      await sendMessage(
        `Dear ${subscription.restaurant?.name || ""}, Your subscription to ${
          subscription.plan.name
        } has been activated successfully. Thank you!`,
        subscription.restaurant?.phone || ""
      );
    } catch (error) {
      console.error("Failed to send subscription notification:", error);
    }

    // Broadcast subscription update via WebSocket
    try {
      wsManager.broadcastSubscriptionUpdate({
        subscriptionId: subscription.id,
        status: "ACTIVE",
        paymentStatus: "COMPLETED",
        timestamp: new Date().toISOString(),
        restaurantId: subscription.restaurantId || "",
      });

      console.log(`Broadcasted subscription activation: ${subscription.id}`);
    } catch (wsError) {
      console.error("Failed to broadcast subscription update:", wsError);
    }

    console.log(`Subscription payment completed: ${subscription.id}`);
  } else if (status === "failed") {
    await retryDatabaseOperation(async () => {
      return await prisma.$transaction([
        prisma.restaurantSubscription.update({
          where: { id: subscription.id },
          data: {
            paymentStatus: "FAILED",
            transactionId: data?.id?.toString() || flwRef,
            flwRef: flwRef,
            updatedAt: new Date(),
          },
        }),
        prisma.subscriptionHistory.create({
          data: {
            subscriptionId: subscription.id,
            action: "CREATED",
            newStatus: "PENDING",
            reason: "Payment failed",
          },
        }),
      ]);
    });

    // Send failure notification
    try {
      await sendMessage(
        `Dear ${
          subscription.restaurant?.name || ""
        }, Your subscription payment failed. Please try again or contact support.`,
        subscription.restaurant?.phone || ""
      );
    } catch (error) {
      console.error("Failed to send subscription failure notification:", error);
    }

    // Broadcast subscription payment failure via WebSocket
    try {
      wsManager.broadcastSubscriptionUpdate({
        subscriptionId: subscription.id,
        status: "PENDING",
        paymentStatus: "FAILED",
        timestamp: new Date().toISOString(),
        restaurantId: subscription.restaurantId || "",
      });

      console.log(
        `Broadcasted subscription payment failure: ${subscription.id}`
      );
    } catch (wsError) {
      console.error("Failed to broadcast subscription failure:", wsError);
    }

    console.log(`Subscription payment failed: ${subscription.id}`);
  }

  return subscription;
}

/**
 * Subscription payment webhook handler
 * POST /subscriptions/webhook
 */
export const handleSubscriptionWebhook = async (
  req: Request,
  res: Response
) => {
  try {
    const payload = req.body;
    const paymentProvider = detectPaymentProvider(payload);

    console.log(
      `${paymentProvider} Subscription Webhook received:`,
      JSON.stringify(payload, null, 2)
    );

    if (paymentProvider === "FLUTTERWAVE") {
      const secretHash = process.env.FLW_SECRET_HASH;
      const signature = req.headers["verif-hash"];

      if (!signature || signature !== secretHash) {
        console.log("Unauthorized webhook - invalid signature");
        return res.status(401).json({ error: "Unauthorized webhook" });
      }

      const txRef =
        payload.tx_ref ||
        payload.txRef ||
        payload.data?.tx_ref ||
        payload.data?.txRef;
      const flwRef =
        payload.flw_ref ||
        payload.flwRef ||
        payload.data?.flw_ref ||
        payload.data?.flwRef;
      const status = payload.status || payload.data?.status;

      if (!txRef) {
        console.error("No transaction reference found in webhook");
        return res.status(400).json({ error: "No transaction reference" });
      }

      // Check if this is a subscription payment (contains SUB_ prefix)
      if (txRef.includes("SUB_")) {
        console.log("Processing subscription payment webhook");
        await processSubscriptionPayment(
          txRef,
          flwRef,
          status,
          "FLUTTERWAVE",
          payload
        );
      } else {
        console.log("Not a subscription payment, skipping");
      }
    } else if (paymentProvider === "PAYPACK") {
      const paypackSignature = req.headers["x-paypack-signature"] as string;
      const paypackSecret = process.env.PAYPACK_WEBHOOK_SECRET;

      if (!paypackSecret) {
        console.error("PayPack webhook secret not configured");
        return res.status(500).json({ error: "Webhook configuration error" });
      }

      if (!paypackSignature) {
        console.log("Missing PayPack signature header");
        return res.status(401).json({ error: "Missing signature header" });
      }

      let rawBody: string;
      if ((req as any).rawBody) {
        rawBody = (req as any).rawBody;
      } else {
        rawBody = JSON.stringify(payload);
      }

      const expectedSignature = crypto
        .createHmac("sha256", paypackSecret)
        .update(rawBody)
        .digest("base64");

      if (paypackSignature !== expectedSignature) {
        console.log("Invalid PayPack webhook signature");
        return res.status(401).json({ error: "Invalid webhook signature" });
      }

      const paymentStatus = payload?.data?.status;
      const txRef = payload.data?.ref;
      const flwRef = payload.data?.ref;

      if (!txRef) {
        console.error("No transaction reference found in PayPack webhook");
        return res.status(400).json({ error: "No transaction reference" });
      }

      // Check if this is a subscription payment
      if (txRef.includes("SUB_")) {
        console.log("Processing PayPack subscription payment webhook");
        await processSubscriptionPayment(
          txRef,
          flwRef,
          paymentStatus,
          "PAYPACK",
          payload
        );
      } else {
        console.log("Not a subscription payment, skipping");
      }
    }

    res
      .status(200)
      .json({ message: "Subscription webhook processed successfully" });
  } catch (error: any) {
    console.error("Subscription webhook processing error:", error);

    if (error.message?.includes("timeout") || error.code === "P1017") {
      return res.status(503).json({
        error: "Service temporarily unavailable",
        message: "Database connection issue, webhook will be retried",
      });
    }

    res.status(500).json({
      error: "Webhook processing failed",
      details: error.message,
    });
  }
};

/**
 * Detect payment provider from webhook payload
 */
function detectPaymentProvider(body: any): "FLUTTERWAVE" | "PAYPACK" {
  // PayPack webhook structure
  if (body?.data?.status !== undefined && body?.data?.ref !== undefined) {
    return "PAYPACK";
  }

  // Flutterwave webhook structure
  if (
    body?.txRef !== undefined ||
    body?.tx_ref !== undefined ||
    body?.["event.type"] !== undefined ||
    body?.event !== undefined
  ) {
    return "FLUTTERWAVE";
  }

  // Default to Flutterwave
  return "FLUTTERWAVE";
}
