import { Request, Response } from "express";
import crypto from "crypto";
import prisma from "../prisma";
import {
  sendAdminOrderConfirmationEmail,
  sendLogisticsOrderNotificationEmail,
  sendPaymentConfirmationEmail,
  sendPaymentFailedEmail,
} from "../utils/emailTemplates";
import { sendMessage } from "../utils/sms.utility";
import { clearCartService } from "../services/cart.service";
import { retryDatabaseOperation } from "../utils/db-retry.utls";
import { wsManager } from "../index";
import { OrderStatus, PaymentStatus, SubscriptionStatus } from "@prisma/client";
import { createNotificationService } from "../services/notification.services";

// Process wallet transactions with WebSocket notification
async function processWalletTransaction(
  txRef: string,
  flwRef: string,
  status: string,
  currency?: string,
  transactionId?: string
) {
  console.log("Processing wallet transaction for reference:", {
    txRef,
    flwRef,
    transactionId,
  });

  const walletTransaction = await retryDatabaseOperation(async () => {
    return await prisma.walletTransaction.findFirst({
      where: {
        OR: [
          { flwTxRef: txRef },
          { flwRef: txRef },
          { id: txRef },
          { externalTxId: txRef },
          { flwTxRef: flwRef },
          { flwRef: flwRef },
          { externalTxId: flwRef },
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
    console.log("No matching wallet transaction found for:", { txRef, flwRef });
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
            externalTxId: transactionId || flwRef,
            flwRef: flwRef,
            updatedAt: new Date(),
          },
        }),
      ]);
    });

    // Send notification
    try {
      await sendMessage(
        `Dear ${walletTransaction.wallet.restaurant.name}, TIN: ${walletTransaction.wallet.restaurant.tin}, Payment completed of Rwf${walletTransaction.amount} for wallet Top-up. Thank you!`,
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
          externalTxId: flwRef,
          flwRef: flwRef,
          updatedAt: new Date(),
        },
      });
    });

    console.log(`Wallet top-up failed: ${walletTransaction.id}`);
  }

  return walletTransaction;
}

// Process voucher repayment payment with WebSocket notification
async function processVoucherRepaymentPayment(
  txRef: string,
  flwRef: string,
  status: string,
  paymentProvider: "FLUTTERWAVE" | "PAYPACK" = "FLUTTERWAVE",
  data?: any
) {
  console.log("Processing voucher repayment for reference:", txRef);

  const repaymentTransaction = await retryDatabaseOperation(async () => {
    return await prisma.voucherRepayment.findFirst({
      where: {
        OR: [
          { paymentReference: txRef },
          { paymentReference: flwRef },
          { paymentReference: { contains: txRef.split("_").pop() || "" } },
        ],
      },
      include: {
        voucher: {
          include: { restaurant: true },
        },
        loan: true,
      },
    });
  });

  if (!repaymentTransaction) {
    console.log("No matching voucher repayment found for txRef:", txRef);
    return null;
  }

  console.log("Found matching voucher repayment:", repaymentTransaction.id);

  if (status === "successful") {
    await retryDatabaseOperation(async () => {
      return await prisma.$transaction(async (tx) => {
        // Update voucher credit for successful payment
        await tx.voucher.update({
          where: { id: repaymentTransaction.voucherId! },
          data: {
            remainingCredit: {
              increment: repaymentTransaction.amount,
            },
            totalCredit: {
              increment: repaymentTransaction.amount,
            },
          },
        });

        // If there's a loan, check if it's fully paid
        if (repaymentTransaction.loanId) {
          // Calculate outstanding balance
          const transactions = await tx.voucherTransaction.findMany({
            where: { voucher: { loanId: repaymentTransaction.loanId } },
          });

          const repayments = await tx.voucherRepayment.findMany({
            where: { loanId: repaymentTransaction.loanId },
          });

          const penalties = await tx.voucherPenalty.findMany({
            where: {
              voucher: { loanId: repaymentTransaction.loanId },
              status: "PENDING",
            },
          });

          const totalUsed = transactions.reduce(
            (sum, t) => sum + t.amountCharged,
            0
          );
          const totalServiceFees = transactions.reduce(
            (sum, t) => sum + t.serviceFee,
            0
          );
          const totalPenalties = penalties.reduce(
            (sum, p) => sum + p.penaltyAmount,
            0
          );
          const totalRepayments = repayments.reduce(
            (sum, r) => sum + r.amount,
            0
          );

          const outstanding =
            totalUsed + totalServiceFees + totalPenalties - totalRepayments;

          // If fully paid, update loan and voucher status
          if (outstanding <= 0) {
            await tx.loanApplication.update({
              where: { id: repaymentTransaction.loanId },
              data: { status: "SETTLED" },
            });

            await tx.voucher.updateMany({
              where: { loanId: repaymentTransaction.loanId },
              data: { status: "SETTLED" },
            });

            console.log(`Loan ${repaymentTransaction.loanId} fully settled`);
          }
        }
      });
    });

    // Broadcast voucher repayment success
    try {
      wsManager.broadcastRepaymentUpdate({
        repaymentId: repaymentTransaction.id,
        loanId: repaymentTransaction.loanId || "",
        voucherId: repaymentTransaction.voucherId || "",
        action: "PROCESSED",
        timestamp: new Date().toISOString(),
        restaurantId: repaymentTransaction.restaurantId,
        data: {
          amount: repaymentTransaction.amount,
          paymentMethod: repaymentTransaction.paymentMethod,
        },
      });

      console.log(
        `Broadcasted voucher repayment success: ${repaymentTransaction.id}`
      );
    } catch (wsError) {
      console.error("Failed to broadcast voucher repayment:", wsError);
    }

    console.log(`Voucher repayment completed: ${repaymentTransaction.id}`);
  } else if (status === "failed") {
    // Remove repayment record for failed payment
    await retryDatabaseOperation(async () => {
      return await prisma.voucherRepayment.delete({
        where: { id: repaymentTransaction.id },
      });
    });

    // Broadcast voucher repayment failure
    try {
      wsManager.broadcastRepaymentUpdate({
        repaymentId: repaymentTransaction.id,
        loanId: repaymentTransaction.loanId || "",
        voucherId: repaymentTransaction.voucherId || "",
        action: "FAILED",
        timestamp: new Date().toISOString(),
        restaurantId: repaymentTransaction.restaurantId,
        data: {
          amount: repaymentTransaction.amount,
          paymentMethod: repaymentTransaction.paymentMethod,
        },
      });

      console.log(
        `Broadcasted voucher repayment failure: ${repaymentTransaction.id}`
      );
    } catch (wsError) {
      console.error("Failed to broadcast voucher repayment failure:", wsError);
    }

    console.log(`Voucher repayment failed: ${repaymentTransaction.id}`);
  }

  return repaymentTransaction;
}

// Process checkout payment with WebSocket notification
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

  console.log("Found matching order:", orderData);

  if (status === "successful" && orderData.paymentStatus !== "COMPLETED") {
    const updateData: any = {
      paymentStatus: PaymentStatus.COMPLETED,
      flwStatus: "successful",
      transactionId: data?.id?.toString() || flwRef,
      flwRef: flwRef,
      paidAt: new Date(),
      updatedAt: new Date(),
    };

    if (paymentProvider === "FLUTTERWAVE") {
      updateData.appFee = data?.appfee || data?.data?.fee;
      updateData.merchantFee = data?.merchantfee || data?.data?.merchantfee;
    } else if (paymentProvider === "PAYPACK") {
      updateData.appFee = data?.appfee || data?.data?.fee;
    }

    await retryDatabaseOperation(async () => {
      return await prisma.order.update({
        where: { id: orderData.id },
        data: updateData,
      });
    });

    // Update order status
    try {
      await retryDatabaseOperation(async () => {
        return await prisma.order.update({
          where: { id: orderData.id },
          data: {
            paymentStatus: PaymentStatus.COMPLETED,
            status: OrderStatus.CONFIRMED,
            updatedAt: new Date(),
          },
        });
      });

      // BROADCAST ORDER PAYMENT SUCCESS
      try {
        wsManager.broadcastOrderUpdate({
          orderId: orderData.id,
          status: "CONFIRMED",
          paymentStatus: "COMPLETED",
          timestamp: new Date().toISOString(),
          restaurantId: orderData.restaurantId,
          data: {
            orderNumber: orderData.orderNumber,
            totalAmount: orderData.totalAmount,
            currency: orderData.currency || "",
            paymentMethod: orderData.paymentMethod || "",
            transactionId: data?.id?.toString() || flwRef,
            items: orderData.orderItems.map((item) => ({
              productId: item.productId,
              productName: item.productName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.subtotal,
            })),
          },
        });

        console.log(`Broadcasted order payment success: ${orderData.id}`);
      } catch (wsError) {
        console.error("Failed to broadcast order update:", wsError);
      }

      // If voucher was used, broadcast voucher transaction
      if (orderData.voucherId && orderData.voucher) {
        try {
          wsManager.broadcastVoucherTransactionUpdate({
            transactionId: orderData.id,
            voucherId: orderData.voucherId,
            orderId: orderData.id,
            action: "PAYMENT_PROCESSED",
            timestamp: new Date().toISOString(),
            restaurantId: orderData.restaurantId,
            data: {
              orderAmount: orderData.totalAmount,
              voucherCode: orderData.voucherCode || "",
            },
          });

          console.log(
            `Broadcasted voucher transaction: ${orderData.voucherId}`
          );
        } catch (wsError) {
          console.error("Failed to broadcast voucher transaction:", wsError);
        }
      }
    } catch (orderUpdateError) {
      console.error("Failed to update order status:", orderUpdateError);
    }

    // Clear cart
    if (orderData.cartId && (orderData.cart?.cartItems?.length ?? 0) > 0) {
      try {
        await retryDatabaseOperation(async () => {
          return await clearCartService(orderData.cartId!);
        });
      } catch (clearCartError) {
        console.error("Failed to clear cart:", clearCartError);
      }
    }

    // Send notifications to the restaurant
    try {
      await sendMessage(
        `Dear ${orderData.restaurant.name}, TIN: ${orderData.restaurant.tin}, Your order of Rwf${orderData.totalAmount} has been placed successfully. Delivery is next! To order something else, visit www.food.rw`,

        orderData.billingPhone || orderData.restaurant.phone || ""
      );
    } catch (smsError) {
      console.error("Failed to send SMS notification:", smsError);
    }

    // Send notifications
    try {
      await sendMessage(
        `Order #${orderData.orderNumber} has been placed by ${orderData.restaurant.name}`,

        process.env.LOGISTICS_NUMBER_ONE || ""
      );
    } catch (smsError) {
      console.error("Failed to send SMS notification:", smsError);
    }

    // Send notifications
    try {
      await sendMessage(
        `Order #${orderData.orderNumber} has been placed by ${orderData.restaurant.name}`,

        process.env.LOGISTICS_NUMBER_TWO || ""
      );
    } catch (smsError) {
      console.error("Failed to send SMS notification:", smsError);
    }

    // Send notifications
    try {
      await sendMessage(
        `Order #${orderData.orderNumber} has been placed by ${orderData.restaurant.name}`,

        process.env.PRIVATE_RECEIVER || ""
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
        orderNumber: orderData.orderNumber,
      });
    } catch (emailError) {
      console.error("Failed to send confirmation email:", emailError);
    }

    try {
      await sendAdminOrderConfirmationEmail({
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
        orderNumber: orderData.orderNumber,
      });
    } catch (emailError) {
      console.error("Failed to send confirmation email:", emailError);
    }

    try {
      await sendLogisticsOrderNotificationEmail({
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
        orderNumber: orderData.orderNumber,
      });
    } catch (emailError) {
      console.error("Failed to send confirmation email:", emailError);
    }

    await createNotificationService({
      title: "New Order Received",
      message: `Order #${orderData.orderNumber} has been placed by ${orderData.restaurant.name}`,
      eventType: "NEW_ORDER_PLACED",
      targetType: "ROLE_BASED",
      targetRole: "ADMIN",
      metadata: {
        orderId: orderData.id,
        orderNumber: orderData.orderNumber,
        restaurantId: orderData.restaurantId,
        totalAmount: orderData.totalAmount,
      },
    });

    await createNotificationService({
      title: "New Order Received",
      message: `Order #${orderData.orderNumber} has been placed by ${orderData.restaurant.name}`,
      eventType: "NEW_ORDER_PLACED",
      targetType: "ROLE_BASED",
      targetRole: "LOGISTICS",
      metadata: {
        orderId: orderData.id,
        orderNumber: orderData.orderNumber,
        restaurantId: orderData.restaurantId,
        totalAmount: orderData.totalAmount,
      },
    });

    await createNotificationService({
      title: "Payment Successful",
      message: `Payment of ${orderData.totalAmount} RWF for order #${orderData.orderNumber} has been processed`,
      eventType: "PAYMENT_PROCESSED",
      targetType: "SPECIFIC_USER",
      targetId: orderData.restaurantId,
      metadata: {
        orderId: orderData.id,
        amount: orderData.totalAmount,
        paymentMethod: orderData.paymentMethod,
        transactionId: orderData.transactionId,
      },
    });

    await createNotificationService({
      title: "Order Confirmed",
      message: `Your order #${orderData.orderNumber} has been confirmed and is being prepared`,
      eventType: "ORDER_CONFIRMED",
      targetType: "SPECIFIC_USER",
      targetId: orderData.restaurantId,
      metadata: {
        orderId: orderData.id,
        orderNumber: orderData.orderNumber,
        estimatedDelivery: orderData.estimatedDelivery,
      },
    });

    console.log(`Checkout payment completed: ${orderData.id}`);
  } else if (status === "failed") {
    await retryDatabaseOperation(async () => {
      return await prisma.order.update({
        where: { id: orderData.id },
        data: {
          paymentStatus: PaymentStatus.FAILED,
          flwStatus: "failed",
          transactionId: data?.id?.toString() || flwRef,
          flwRef: flwRef,
          updatedAt: new Date(),
        },
      });
    });

    // Update order status
    try {
      await retryDatabaseOperation(async () => {
        return await prisma.order.update({
          where: { id: orderData.id },
          data: {
            paymentStatus: PaymentStatus.FAILED,
            status: OrderStatus.CANCELLED,
            updatedAt: new Date(),
          },
        });
      });

      // BROADCAST ORDER PAYMENT FAILURE
      try {
        wsManager.broadcastOrderUpdate({
          orderId: orderData.id,
          status: "CANCELLED",
          paymentStatus: "FAILED",
          timestamp: new Date().toISOString(),
          restaurantId: orderData.restaurantId,
          data: {
            orderNumber: orderData.orderNumber,
            totalAmount: orderData.totalAmount,
            currency: orderData.currency || "",
            paymentMethod: orderData.paymentMethod || "",
            transactionId: data?.id?.toString() || flwRef,
            error: "Payment failed",
          },
        });

        console.log(`Broadcasted order payment failure: ${orderData.id}`);
      } catch (wsError) {
        console.error("Failed to broadcast order failure:", wsError);
      }
    } catch (orderUpdateError) {
      console.error("Failed to update failed order status:", orderUpdateError);
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
        orderNumber: orderData.orderNumber,
      });
    } catch (emailError) {
      console.error("Failed to send payment failed email:", emailError);
    }

    // In payment webhook when payment fails
    await createNotificationService({
      title: "Payment Failed",
      message: `Payment for order #${orderData.orderNumber} failed. Please try again or contact support`,
      eventType: "PAYMENT_FAILED",
      targetType: "SPECIFIC_USER",
      targetId: orderData.restaurantId,
      metadata: {
        orderId: orderData.id,
        amount: orderData.totalAmount,
        failureReason: "Payment failed",
      },
    });

    console.log(`Checkout payment failed: ${orderData.id}`);
  }

  return orderData;
}

function detectPaymentProvider(body: any): "FLUTTERWAVE" | "PAYPACK" {
  if (body?.data?.status !== undefined && body?.data?.ref !== undefined) {
    return "PAYPACK";
  }

  if (
    body?.txRef !== undefined ||
    body?.tx_ref !== undefined ||
    body?.["event.type"] !== undefined ||
    body?.event !== undefined
  ) {
    return "FLUTTERWAVE";
  }

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
    const transactionType =
      data.meta_data?.transaction_type ||
      data.data?.meta_data?.transaction_type;

    if (!txRef) {
      console.error("No transaction reference found in Flutterwave webhook");
      return;
    }

    console.log(
      `Processing transaction: txRef=${txRef}, flwRef=${flwRef}, status=${status}, type=${transactionType}`
    );

    // Check transaction type from metadata first
    if (
      transactionType === "WALLET_TOPUP" ||
      txRef.includes("WALLET_TOPUP_") ||
      txRef.startsWith("175")
    ) {
      console.log(
        "Processing wallet top-up via charge.completed (from metadata)"
      );
      await processWalletTransaction(
        txRef,
        flwRef,
        status,
        data.currency,
        data.data?.id?.toString()
      );
    } else if (txRef.includes("SUB_")) {
      console.log("Processing subscription payment via charge.completed");
      await processSubscriptionPayment(
        txRef,
        flwRef,
        status,
        "FLUTTERWAVE",
        data
      );
    } else if (txRef.includes("repay_")) {
      console.log("Processing voucher repayment via charge.completed");
      await processVoucherRepaymentPayment(
        txRef,
        flwRef,
        status,
        "FLUTTERWAVE",
        data
      );
    } else if (
      txRef &&
      (txRef.includes("WALLET_TOPUP_") || txRef.startsWith("175"))
    ) {
      console.log(
        "Processing wallet top-up via charge.completed (from txRef pattern)"
      );
      await processWalletTransaction(
        txRef,
        flwRef,
        status,
        data.currency,
        data.data?.id?.toString()
      );
    } else {
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

/**
 * Process subscription payment webhook with better error handling and status updates
 */
async function processSubscriptionPayment(
  txRef: string,
  flwRef: string,
  status: string,
  paymentProvider: "FLUTTERWAVE" | "PAYPACK" = "FLUTTERWAVE",
  data?: any
) {
  console.log(
    "Processing subscription payment for reference:",
    txRef,
    "Provider:",
    paymentProvider
  );

  try {
    const subscription = await retryDatabaseOperation(async () => {
      return await prisma.restaurantSubscription.findFirst({
        where: {
          OR: [
            { txRef: txRef },
            { flwRef: txRef },
            { transactionId: txRef },
            { flwRef: flwRef },
            { transactionId: flwRef },
          ],
        },
        include: {
          restaurant: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          plan: true,
        },
      });
    });

    console.log("Subscription found:", subscription ? subscription.id : "null");

    if (!subscription) {
      console.log("No matching subscription found for:", {
        txRef,
        flwRef,
        provider: paymentProvider,
      });
      return null;
    }

    console.log(
      "Processing subscription:",
      subscription.id,
      "Status:",
      subscription.status,
      "Payment Status:",
      subscription.paymentStatus
    );

    // Handle both "successful" and "success" statuses
    const isSuccessful = status === "successful" || status === "success";
    const isFailed = status === "failed" || status === "failure";

    if (isSuccessful && subscription.paymentStatus !== "COMPLETED") {
      console.log("Updating subscription to COMPLETED status");

      const updateData: any = {
        paymentStatus: PaymentStatus.COMPLETED,
        status: SubscriptionStatus.ACTIVE,
        transactionId: data?.id?.toString() || flwRef,
        flwRef: flwRef,
        amountPaid: subscription.plan.price,
        updatedAt: new Date(),
      };

      // Update subscription and create history in transaction
      const updatedSubscription = await retryDatabaseOperation(async () => {
        return await prisma.$transaction([
          prisma.restaurantSubscription.update({
            where: { id: subscription.id },
            data: updateData,
          }),
          prisma.subscriptionHistory.create({
            data: {
              subscriptionId: subscription.id,
              action: "CREATED",
              newStatus: SubscriptionStatus.ACTIVE,
              newPlanId: subscription.planId,
              reason: `Payment completed successfully via ${paymentProvider} webhook`,
            },
          }),
          // Also create a subscription payment record
          prisma.subscriptionPayment.create({
            data: {
              subscriptionId: subscription.id,
              amount: subscription.plan.price,
              paymentMethod: subscription.paymentMethod || "MOBILE_MONEY",
              paymentStatus: PaymentStatus.COMPLETED,
              txRef: txRef,
              flwRef: flwRef,
              transactionId: data?.id?.toString() || flwRef,
              paidAt: new Date(),
            },
          }),
        ]);
      });

      console.log(
        "Subscription updated successfully:",
        updatedSubscription[0].id
      );

      try {
        await sendMessage(
          `Dear ${subscription.restaurant.name}, Your subscription to ${subscription.plan.name} has been activated successfully. Thank you!`,
          subscription.restaurant.phone || ""
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
          restaurantId: subscription.restaurantId,
        });

        console.log(`Broadcasted subscription activation: ${subscription.id}`);
      } catch (wsError) {
        console.error("Failed to broadcast subscription update:", wsError);
      }

      console.log(`Subscription payment completed: ${subscription.id}`);
      return subscription;
    } else if (isFailed && subscription.paymentStatus !== "FAILED") {
      console.log("Updating subscription to FAILED status");

      await retryDatabaseOperation(async () => {
        return await prisma.$transaction([
          prisma.restaurantSubscription.update({
            where: { id: subscription.id },
            data: {
              paymentStatus: PaymentStatus.FAILED,
              status: SubscriptionStatus.CANCELLED,
              transactionId: data?.id?.toString() || flwRef,
              flwRef: flwRef,
              updatedAt: new Date(),
            },
          }),
          prisma.subscriptionHistory.create({
            data: {
              subscriptionId: subscription.id,
              action: "CANCELLED",
              newStatus: SubscriptionStatus.CANCELLED,
              reason: `Payment failed via ${paymentProvider} webhook`,
            },
          }),
        ]);
      });

      // Send failure notification
      try {
        await sendMessage(
          `Dear ${subscription.restaurant.name}, Your subscription payment failed. Please try again or contact support.`,
          subscription.restaurant.phone || ""
        );
      } catch (error) {
        console.error("Failed to send failure notification:", error);
      }

      // Broadcast subscription payment failure via WebSocket
      try {
        wsManager.broadcastSubscriptionUpdate({
          subscriptionId: subscription.id,
          status: "CANCELLED",
          paymentStatus: "FAILED",
          timestamp: new Date().toISOString(),
          restaurantId: subscription.restaurantId,
        });

        console.log(
          `Broadcasted subscription payment failure: ${subscription.id}`
        );
      } catch (wsError) {
        console.error("Failed to broadcast subscription failure:", wsError);
      }

      console.log(`Subscription payment failed: ${subscription.id}`);
      return subscription;
    } else {
      console.log(`Subscription ${subscription.id} already in final state:`, {
        paymentStatus: subscription.paymentStatus,
        status: subscription.status,
      });
      return subscription;
    }
  } catch (error: any) {
    console.error("Error in processSubscriptionPayment:", error);
    throw error;
  }
}

/** Payment webhook handler
 * POST /payments/webhook
 */
export const handlePaymentWebhook = async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    const paymentProvider = detectPaymentProvider(payload);

    console.log(
      `${paymentProvider} Webhook received:`,
      JSON.stringify(payload, null, 2)
    );

    if (paymentProvider === "FLUTTERWAVE") {
      const secretHash = process.env.FLW_SECRET_HASH;
      const signature = req.headers["verif-hash"];

      if (!signature || signature !== secretHash) {
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

      console.log("txRef", txRef, "flwRef", flwRef, "status", status);

      if (!txRef) {
        console.error("No transaction reference found in webhook");
        return res.status(400).json({ error: "No transaction reference" });
      }

      // Process subscription payments for both main flow and charge.completed
      // Check if this is a subscription by looking up in the database
      const subscription = await prisma.restaurantSubscription.findFirst({
        where: {
          OR: [
            { transactionId: txRef },
            { flwRef: txRef },
            { txRef: { contains: txRef } },
          ],
        },
      });

      if (subscription) {
        console.log("Found subscription for PayPack webhook:", subscription.id);
        await processSubscriptionPayment(
          subscription.txRef || txRef || "",
          flwRef || "",
          status || "",
          "FLUTTERWAVE",
          payload
        );
      } else {
        // Process regular payments through charge.completed handler
        await handleChargeCompleted(payload);
      }
    } else if (paymentProvider === "PAYPACK") {
      const paypackSignature = req.headers["x-paypack-signature"] as string;
      const paypackSecret = process.env.PAYPACK_WEBHOOK_SECRET;

      if (!paypackSecret) {
        return res.status(500).json({ error: "Webhook configuration error" });
      }

      if (!paypackSignature) {
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
        return res.status(401).json({ error: "Invalid webhook signature" });
      }

      const paymentStatus = payload?.data?.status;
      const txRef = payload.data?.ref;
      const flwRef = payload.data?.ref;
      const transactionType =
        payload.meta_data?.transaction_type ||
        payload.data?.meta_data?.transaction_type;

      console.log(
        `PayPack webhook - txRef: ${txRef}, status: ${paymentStatus}`
      );

      if (!txRef) {
        console.error("No transaction reference found in PayPack webhook");
        return res
          .status(400)
          .json({ error: "No transaction reference provided" });
      }

      // Check if this is a subscription by looking up in the database
      const subscription = await prisma.restaurantSubscription.findFirst({
        where: {
          OR: [
            { transactionId: txRef },
            { flwRef: txRef },
            { txRef: { contains: txRef } },
          ],
        },
      });

      if (subscription) {
        console.log("Found subscription for PayPack webhook:", subscription.id);
        await processSubscriptionPayment(
          subscription.txRef || txRef || "",
          flwRef || "",
          paymentStatus || "",
          "PAYPACK",
          payload
        );
      } else if (txRef.includes("repay_")) {
        console.log("Processing PayPack voucher repayment");
        await processVoucherRepaymentPayment(
          txRef || "",
          flwRef || "",
          paymentStatus || "",
          "PAYPACK",
          payload
        );
      } else if (
        transactionType === "WALLET_TOPUP" ||
        txRef.includes("WALLET_TOPUP_") ||
        txRef.startsWith("175")
      ) {
        console.log("Processing PayPack wallet transaction");
        await processWalletTransaction(
          txRef || "",
          flwRef || "",
          paymentStatus || ""
        );
      } else {
        console.log("Processing PayPack checkout payment");
        await processCheckoutPayment(
          txRef || "",
          flwRef || "",
          paymentStatus || "",
          "PAYPACK"
        );
      }
    }

    res.status(200).json({ message: "Webhook processed successfully" });
  } catch (error: any) {
    console.error("Payment webhook processing error:", error);

    if (error.message?.includes("timeout") || error.code === "P1017") {
      return res.status(503).json({
        error: "Service temporarily unavailable",
        message: "Database connection issue, webhook will be retried",
      });
    }

    res.status(500).json({ error: "Webhook processing failed" });
  }
};
