import { Request, Response } from "express";
import prisma from "../prisma";
import { sendWalletNotificationEmail } from "../utils/emailTemplates";

export const handlePaymentWebhook = async (req: Request, res: Response) => {
  try {
    // Verify webhook signature
    const secretHash = process.env.FLW_SECRET_HASH;
    const signature = req.headers["verif-hash"];

    if (!signature || signature !== secretHash) {
      return res.status(401).json({ error: "Unauthorized webhook" });
    }

    const payload = req.body;
    console.log(
      "Flutterwave Webhook received:",
      JSON.stringify(payload, null, 2)
    );

    // Handle different event types - FIX: Use 'event.type' instead of 'event'
    const eventType = payload["event.type"] || payload.event;

    switch (eventType) {
      case "MOBILEMONEYRW_TRANSACTION":
      case "CARD_TRANSACTION":
      case "charge.completed":
        await handleChargeCompleted(payload);
        break;

      case "transfer.completed":
        await handleTransferCompleted(payload);
        break;

      default:
        console.log(`Unhandled webhook event: ${eventType}`);
    }

    res.status(200).json({ message: "Webhook processed successfully" });
  } catch (error: any) {
    console.error("Webhook processing error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
};

const handleChargeCompleted = async (data: any) => {
  try {
    console.log("Processing charge.completed webhook:", data);

    // Extract transaction reference - FIX: Use 'txRef' instead of 'tx_ref'
    const txRef = data.txRef || data.tx_ref;
    const flwRef = data.flwRef || data.flw_ref;
    const status = data.status;
    const currency = data.currency;

    console.log(
      `Processing transaction: txRef=${txRef}, flwRef=${flwRef}, status=${status}`
    );

    // Check if this is a wallet top-up transaction
    if (txRef && (txRef.includes("WALLET_TOPUP_") || txRef.startsWith("175"))) {
      console.log("Detected wallet top-up transaction");

      // Find the corresponding wallet transaction
      const walletTransaction = await prisma.walletTransaction.findFirst({
        where: {
          OR: [
            { flwTxRef: txRef },
            { flwRef: txRef },
            { id: txRef },
            // Also check if txRef contains the wallet transaction ID
            { flwTxRef: { contains: txRef.split("_").pop() || "" } },
          ],
        },
        include: {
          wallet: {
            include: { restaurant: true },
          },
        },
      });

      if (walletTransaction) {
        console.log("Found matching wallet transaction:", walletTransaction.id);

        if (
          status === "successful" &&
          walletTransaction.status !== "COMPLETED"
        ) {
          const newBalance =
            walletTransaction.wallet.balance + walletTransaction.amount;

          // Update wallet balance and transaction
          await prisma.$transaction([
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
                externalTxId: data.id?.toString(),
                flwRef: flwRef,
                updatedAt: new Date(),
              },
            }),
          ]);

          // Send notification email
          try {
            await sendWalletNotificationEmail({
              email: walletTransaction.wallet.restaurant.email,
              restaurantName: walletTransaction.wallet.restaurant.name,
              type: "TOP_UP",
              amount: walletTransaction.amount,
              newBalance,
              transactionId: flwRef || walletTransaction.id,
              paymentMethod: walletTransaction.paymentMethod || "MOBILE_MONEY",
            });
          } catch (emailError) {
            console.log(
              "Failed to send wallet notification email:",
              emailError
            );
          }

          console.log(
            `Wallet top-up completed: ${walletTransaction.amount} ${currency} for wallet ${walletTransaction.walletId}`
          );
        } else if (status === "failed") {
          // Update transaction as failed
          await prisma.walletTransaction.update({
            where: { id: walletTransaction.id },
            data: {
              status: "FAILED",
              flwStatus: "failed",
              flwMessage: "Payment failed via webhook",
              externalTxId: data.id?.toString(),
              flwRef: flwRef,
              updatedAt: new Date(),
            },
          });

          console.log(`Wallet top-up failed: ${walletTransaction.id}`);
        } else {
          console.log(
            `Transaction already processed or status unchanged: ${walletTransaction.status}`
          );
        }
      } else {
        console.log("No matching wallet transaction found for txRef:", txRef);
        // Additional logging for debugging
        console.log("Available wallet transactions with similar refs:");
        const similarTransactions = await prisma.walletTransaction.findMany({
          where: {
            OR: [
              { flwTxRef: { contains: txRef.substring(0, 10) } },
              { status: "PENDING" },
            ],
          },
          select: { id: true, flwTxRef: true, status: true, amount: true },
          take: 5,
        });
        console.log(similarTransactions);
      }
    }

    // Check if this is a regular checkout payment
    const checkout = await prisma.cHECKOUT.findFirst({
      where: {
        OR: [{ txRef: txRef }, { paymentReference: txRef }],
      },
      include: {
        restaurant: true,
        cart: {
          include: {
            cartItems: {
              include: { product: true },
            },
          },
        },
      },
    });

    if (checkout) {
      console.log("Found matching checkout:", checkout.id);

      if (status === "successful" && checkout.paymentStatus !== "COMPLETED") {
        await prisma.cHECKOUT.update({
          where: { id: checkout.id },
          data: {
            paymentStatus: "COMPLETED",
            flwStatus: "successful",
            flwMessage: "Payment completed via webhook",
            transactionId: data.id?.toString(),
            flwRef: flwRef,
            paidAt: new Date(),
            updatedAt: new Date(),
          },
        });

        console.log(`Checkout payment completed: ${checkout.id}`);
      } else if (status === "failed") {
        await prisma.cHECKOUT.update({
          where: { id: checkout.id },
          data: {
            paymentStatus: "FAILED",
            flwStatus: "failed",
            flwMessage: "Payment failed via webhook",
            transactionId: data.id?.toString(),
            flwRef: flwRef,
            updatedAt: new Date(),
          },
        });

        console.log(`Checkout payment failed: ${checkout.id}`);
      }
    } else if (!txRef.includes("WALLET_TOPUP_") && !txRef.startsWith("175")) {
      console.log("No matching checkout found for txRef:", txRef);
    }
  } catch (error: any) {
    console.error("Error processing charge.completed webhook:", error);
    throw error;
  }
};

const handleTransferCompleted = async (data: any) => {
  // Handle transfer completion if needed
  console.log("Transfer completed:", data);
};
