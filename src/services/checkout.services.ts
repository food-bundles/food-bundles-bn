import dotenv from "dotenv";
import prisma from "../prisma";
import {
  debitWalletService,
  getWalletByRestaurantIdService,
} from "./wallet.service";
import {
  sendPaymentNotificationEmail,
  cleanPhoneNumber,
  isValidRwandaPhone,
} from "../utils/emailTemplates";
import {
  BankTransferPaymentResult,
  CardPaymentResult,
  CashPaymentResult,
  MobileMoneyPaymentResult,
  MobileMoneyPaymentSubmissionData,
  UpdateCheckoutData,
} from "../types/paymentTypes";
import { OrderStatus, PaymentMethod } from "@prisma/client";
import {
  createOrderFromCartService,
  getOrderByIdService,
  updateOrderService,
} from "./order.services";
import { retryDatabaseOperation } from "../utils/db-retry.utls";

dotenv.config();

// Payment Integration
const PaypackJs = require("paypack-js").default;
const Flutterwave = require("flutterwave-node-v3");

// Initialize Paypack
const paypack = PaypackJs.config({
  client_id: process.env.PAYPACK_APPLICATION_ID,
  client_secret: process.env.PAYPACK_APPLICATION_SECRET,
});

// Initialize Flutterwave
const flw = new Flutterwave(
  process.env.FLW_PUBLIC_KEY,
  process.env.FLW_SECRET_KEY
);

type PaymentResult =
  | MobileMoneyPaymentResult
  | CardPaymentResult
  | BankTransferPaymentResult
  | CashPaymentResult;

interface CreateCheckoutData {
  cartId: string;
  restaurantId: string;
  notes?: string;
  deliveryDate?: Date;
  paymentMethod: PaymentMethod;
  billingName?: string;
  billingEmail?: string;
  billingPhone?: string;
  billingAddress?: string;
  cardDetails?: {
    cardNumber: string;
    cvv: string;
    expiryMonth: string;
    expiryYear: string;
    pin?: string;
  };
  bankDetails?: {
    clientIp?: string;
  };
  clientIp?: string;
  deviceFingerprint?: string;
  narration?: string;
  currency?: string;
}

/**
 * Enhanced service to create a new order from cart
 */
export const createCheckoutService = async (data: CreateCheckoutData) => {
  const orderData = {
    cartId: data.cartId,
    restaurantId: data.restaurantId,
    status: OrderStatus.PENDING,
    notes: data.notes,
    requestedDelivery: data.deliveryDate,
    paymentMethod: data.paymentMethod,
    billingName: data.billingName,
    billingEmail: data.billingEmail,
    billingPhone: data.billingPhone,
    billingAddress: data.billingAddress,
  };

  const orderCreated = await createOrderFromCartService(orderData);

  // Process immediate payment
  const paymentResult = await processPaymentService(orderCreated.id!, {
    paymentMethod: data.paymentMethod,
    phoneNumber: data.billingPhone,
    cardDetails: data.cardDetails,
    bankDetails: data.bankDetails,
    processDirectly: true,
  });

  console.log("Payment Result:", paymentResult);

  return paymentResult;
};

/**
 * Enhanced service to process payment
 */
export const processPaymentService = async (
  orderId: string,
  paymentData: {
    paymentMethod: PaymentMethod;
    phoneNumber?: string;
    cardDetails?: {
      cardNumber: string;
      cvv: string;
      expiryMonth: string;
      expiryYear: string;
      pin?: string;
    };
    bankDetails?: {
      clientIp?: string;
    };
    processDirectly?: boolean;
  }
) => {
  let order: Awaited<ReturnType<typeof getOrderByIdService>>;

  try {
    // Get order with retry logic
    order = await getOrderByIdService(orderId);

    if (order.paymentStatus === "COMPLETED") {
      throw new Error("Payment already completed");
    }

    const existingOrder = await retryDatabaseOperation(async () => {
      return await prisma.order.findUnique({
        where: { id: order.id! },
        include: {
          restaurant: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          orderItems: {
            include: {
              product: {
                select: {
                  id: true,
                  productName: true,
                  unitPrice: true,
                  unit: true,
                  images: true,
                  category: true,
                  status: true,
                },
              },
            },
          },
        },
      });
    });

    // Cast to match the expected type since createOrderFromCartService returns a specific type
    order = existingOrder as Awaited<
      ReturnType<typeof createOrderFromCartService>
    >;
  } catch (error: any) {
    console.log("Error in initial order operations:", error);
    if (error.message.includes("timeout") || error.code === "P1017") {
      throw new Error("Database connection issue. Please try again.");
    }
    throw error;
  }

  // Update payment status to processing with retry
  try {
    await updateOrderService(orderId, {
      paymentStatus: "PROCESSING",
      paymentMethod: paymentData.paymentMethod,
    });
  } catch (error: any) {
    console.log("Error updating order to processing:", error);
    // Continue with payment processing even if status update fails
  }

  try {
    let paymentResult: PaymentResult;

    switch (paymentData.paymentMethod) {
      case "MOBILE_MONEY":
        paymentResult = await processMobileMoneyPayment({
          amount: order.totalAmount,
          phoneNumber: paymentData.phoneNumber!,
          txRef: order.txRef!,
          orderId: order.txOrderId!,
          email: order.restaurant.email,
          fullname: order.restaurant.name,
          currency: order.currency || "RWF",
        });
        break;

      case "CARD":
        paymentResult = await processCardPayment({
          amount: order.totalAmount,
          txRef: order.txRef!,
          email: order.billingEmail || order.restaurant.email,
          fullname: order.billingName || order.restaurant.name,
          phoneNumber: paymentData.phoneNumber || order.billingPhone || "",
          currency: order.currency || "RWF",
          cardDetails: paymentData.cardDetails!,
        });
        break;

      case "BANK_TRANSFER":
        paymentResult = await processBankTransfer({
          amount: order.totalAmount,
          txRef: order.txRef!,
          email: order.billingEmail || order.restaurant.email,
          phoneNumber: paymentData.phoneNumber || order.billingPhone || "",
          currency: order.currency || "RWF",
          clientIp:
            paymentData.bankDetails?.clientIp || order.clientIp || "127.0.0.1",
          deviceFingerprint: order.deviceFingerprint || "62wd23423rq324323qew1",
          narration: order.narration || "Order payment",
        });
        break;

      case "CASH":
        try {
          const wallet = await retryDatabaseOperation(async () => {
            return await getWalletByRestaurantIdService(order.restaurantId);
          });

          if (!wallet.isActive) {
            throw new Error("Wallet is inactive. Please contact support.");
          }

          if (wallet.balance < order.totalAmount) {
            throw new Error(
              `Insufficient wallet balance. Available: ${wallet.balance} ${
                wallet.currency
              }, Required: ${order.totalAmount} ${order.currency || "RWF"}`
            );
          }

          const walletDebitResult = await retryDatabaseOperation(async () => {
            return await debitWalletService({
              walletId: wallet.id,
              amount: order.totalAmount,
              description: `Payment for order ${orderId} - Order ${order.txOrderId}`,
              reference: orderId,
              orderId: orderId,
            });
          });

          paymentResult = {
            success: true,
            transactionId: `WALLET_${order.txRef}_${Date.now()}`,
            reference: order.txRef ?? "",
            flwRef: `WALLET_${order.txRef}`,
            status: "successful",
            message: "Payment completed using wallet balance",
            walletDetails: {
              previousBalance: walletDebitResult.transaction.previousBalance,
              newBalance: walletDebitResult.newBalance,
              transactionId: walletDebitResult.transaction.id,
            },
          };
        } catch (walletError: any) {
          paymentResult = {
            success: false,
            transactionId: "",
            reference: order.txRef ?? "",
            flwRef: "",
            status: "failed",
            message: walletError.message || "Wallet payment failed",
            error: walletError.message,
          };
        }
        break;

      default:
        throw new Error("Unsupported payment method");
    }

    // Handle payment result with retry logic
    if (paymentResult.success) {
      const updateData: UpdateCheckoutData = {
        paymentStatus:
          paymentResult.status === "successful" ? "COMPLETED" : "PROCESSING",
        transactionId: paymentResult.transactionId,
        paymentReference: paymentResult.reference,
        flwRef: paymentResult.flwRef,
        flwStatus: paymentResult.status,
        flwMessage: paymentResult.message,
      };

      // Add card payment specific data if applicable
      if (
        paymentData.paymentMethod === "CARD" &&
        "cardPaymentData" in paymentResult &&
        paymentResult.cardPaymentData
      ) {
        const cardData = paymentResult.cardPaymentData;
        updateData.chargedAmount = cardData.chargedAmount;
        updateData.appFee = cardData.appFee;
        updateData.merchantFee = cardData.merchantFee;
        updateData.processorResponse = cardData.processorResponse;
        updateData.authModel = cardData.authModel;
        updateData.deviceFingerprint = cardData.deviceFingerprint;
        updateData.fraudStatus = cardData.fraudStatus;
        updateData.paymentType = cardData.paymentType;
        updateData.chargeType = cardData.chargeType;
        updateData.narration = cardData.narration;
      }

      // Handle transfer details
      if ("transferDetails" in paymentResult && paymentResult.transferDetails) {
        updateData.transferReference =
          paymentResult.transferDetails.transferReference;
        updateData.transferAccount =
          paymentResult.transferDetails.transferAccount;
        updateData.transferBank = paymentResult.transferDetails.transferBank;
        updateData.transferAmount =
          paymentResult.transferDetails.transferAmount;
        updateData.transferNote = paymentResult.transferDetails.transferNote;
        updateData.accountExpiration =
          paymentResult.transferDetails.accountExpiration ?? undefined;
      }

      if (
        "authorizationDetails" in paymentResult &&
        paymentResult.authorizationDetails
      ) {
        updateData.authorizationMode = paymentResult.authorizationDetails.mode;
        updateData.redirectUrl = paymentResult.authorizationDetails.redirectUrl;
        updateData.authorizationUrl =
          paymentResult.authorizationDetails.redirectUrl;
      }

      let updatedCheckout;
      try {
        updatedCheckout = await updateOrderService(orderId, updateData);
      } catch (updateError: any) {
        console.log(
          "Error updating order after successful payment:",
          updateError
        );
        // Even if update fails, payment was successful, so we should return success
        // but log the issue for investigation
        updatedCheckout = order;
      }

      // Update order status with retry
      if (order && order.id) {
        try {
          await retryDatabaseOperation(async () => {
            return await prisma.order.update({
              where: { id: order!.id },
              data: {
                paymentStatus:
                  paymentResult.status === "successful"
                    ? "COMPLETED"
                    : "PROCESSING",
                paymentReference: paymentResult.reference,
                status:
                  paymentResult.status === "successful"
                    ? "CONFIRMED"
                    : "PENDING",
              },
            });
          });
        } catch (orderUpdateError: any) {
          console.log(
            "Error updating order after successful payment:",
            orderUpdateError
          );
        }
      }

      // Send notification email for successful payments
      if (paymentResult.status === "successful" && order.billingEmail) {
        try {
          const products = order.orderItems.map((item) => ({
            name: item.productName,
            quantity: item.quantity,
            price: item.unitPrice * item.quantity,
            unitPrice: item.unitPrice,
          }));

          sendPaymentNotificationEmail({
            amount: order.totalAmount,
            phoneNumber: paymentData.phoneNumber || order.billingPhone || "",
            restaurantName: order.restaurant.name,
            products,
            customer: {
              name: order.billingName || order.restaurant.name,
              email: order.billingEmail!,
            },
            orderId: orderId,
            paymentMethod: paymentData.paymentMethod,
            walletDetails:
              "walletDetails" in paymentResult
                ? paymentResult.walletDetails
                : undefined,
          });
        } catch (emailError) {
          console.log("Error sending notification email:", emailError);
          // Don't fail the payment process if email fails
        }
      }

      return {
        success: true,
        checkout: updatedCheckout,
        order: order,
        transactionId: paymentResult.transactionId,
        redirectUrl:
          "authorizationDetails" in paymentResult
            ? paymentResult.authorizationDetails?.redirectUrl
            : undefined,
        transferDetails:
          "transferDetails" in paymentResult
            ? paymentResult.transferDetails
            : undefined,
        walletDetails:
          "walletDetails" in paymentResult
            ? paymentResult.walletDetails
            : undefined,
        status: paymentResult.status,
        message: paymentResult.message,
      };
    } else {
      // Handle failed payment
      try {
        await Promise.all([
          updateOrderService(orderId, {
            paymentStatus: "FAILED",
            flwStatus: "failed",
            flwMessage: paymentResult.error || "Payment failed",
          }),
          order &&
            order.id &&
            retryDatabaseOperation(async () => {
              return await prisma.order.update({
                where: { id: order!.id },
                data: {
                  paymentStatus: "FAILED",
                  status: "CANCELLED",
                },
              });
            }),
        ]);
      } catch (updateError) {
        console.log("Error updating failed payment status:", updateError);
      }

      return {
        success: false,
        error: paymentResult.error || "Payment failed",
      };
    }
  } catch (error: any) {
    console.log("Error processing payment:", error);

    // Update both order to failed status with retry
    try {
      await Promise.all([
        updateOrderService(orderId, {
          paymentStatus: "FAILED",
          flwStatus: "failed",
          flwMessage: error.message,
        }).catch(console.error),
        order &&
          order.id &&
          retryDatabaseOperation(async () => {
            return await prisma.order.update({
              where: { id: order!.id },
              data: {
                paymentStatus: "FAILED",
                status: "CANCELLED",
              },
            });
          }).catch(console.error),
      ]);
    } catch (updateError) {
      console.log("Error updating payment failure status:", updateError);
    }

    throw new Error(`Payment processing failed: ${error.message}`);
  }
};

/**
 * Service to verify payment status
 */
export const verifyPaymentStatus = async (transactionId: string) => {
  try {
    const response = await flw.Transaction.verify({ id: transactionId });

    if (
      response.status === "success" &&
      response.data.status === "successful"
    ) {
      return {
        success: true,
        data: response.data,
        amount: response.data.amount,
        currency: response.data.currency,
        status: response.data.status,
        flwRef: response.data.flw_ref,
        txRef: response.data.tx_ref,
        chargedAmount: response.data.charged_amount,
        appFee: response.data.app_fee,
        merchantFee: response.data.merchant_fee,
        processorResponse: response.data.processor_response,
      };
    } else {
      return {
        success: false,
        error: "Payment verification failed",
        data: response.data,
        status: response.data?.status,
      };
    }
  } catch (error: any) {
    console.log("Error verifying payment:", error);
    return {
      success: false,
      error: "Payment verification failed  " + error.message,
    };
  }
};

/**
 * Process Rwanda Mobile Money Payment
 */
async function processMobileMoneyPayment({
  amount,
  phoneNumber,
  txRef,
  orderId,
  email,
  fullname,
  currency = "RWF",
}: MobileMoneyPaymentSubmissionData): Promise<MobileMoneyPaymentResult> {
  try {
    // Clean and validate phone number
    const cleanedPhoneNumber = cleanPhoneNumber(phoneNumber);

    if (!isValidRwandaPhone(cleanedPhoneNumber)) {
      throw new Error(
        "Invalid mobile number. Please use format: 078XXXXXXX, 079XXXXXXX, 072XXXXXXX, or 073XXXXXXX"
      );
    }

    console.log(`: ${amount} ${currency} to ${cleanedPhoneNumber}`);

    // Primary: Try PayPack firstProcessing mobile money payment
    try {
      const response = await paypack.cashin({
        number: cleanedPhoneNumber,
        amount: amount,
        environment:
          process.env.NODE_ENV === "production" ? "production" : "development",
      });

      if (response && response.data) {
        // Update order with PayPack reference
        await prisma.order.update({
          where: { txRef: txRef },
          data: {
            paymentReference: response.data.ref || txRef,
            txRef: response.data.ref || txRef,
            flwRef: response.data.ref || txRef,
            network: response.data.provider,
            flwMessage: "PayPack payment initiated",
            paymentType: "PAYPACK_MOBILE_MONEY",
            paymentProvider: "PAYPACK",
          },
        });

        return {
          success: true,
          transactionId: response.data.ref || txRef,
          reference: response.data.ref || txRef,
          flwRef: response.data.ref || txRef,
          status: "pending",
          message:
            "Payment request sent to your phone number, please confirm it.",
          authorizationDetails: {
            mode: "mobile_money",
            redirectUrl: "",
          },
        };
      } else {
        throw new Error("PayPack response invalid or missing reference");
      }
    } catch (error) {
      console.log("PayPack payment failed", error);

      // Fallback: Try Flutterwave
      console.log("Falling back to Flutterwave...");

      const payload = {
        tx_ref: txRef,
        order_id: orderId,
        amount: amount.toString(),
        currency: currency,
        email: email,
        phone_number: cleanedPhoneNumber,
        fullname: fullname,
        redirect_url: `${process.env.CLIENT_PRODUCTION_URL}/restaurant/confirmation`,
      };

      const response = await flw.MobileMoney.rwanda(payload);
      console.log("Mobile Money Response:", response);

      if (response.status === "success") {
        // Update order to indicate fallback to Flutterwave
        await prisma.order.update({
          where: { txRef: txRef },
          data: {
            paymentType: "FLUTTERWAVE_MOBILE_MONEY",
            paymentProvider: "FLUTTERWAVE",
          },
        });

        return {
          success: true,
          transactionId: response.data?.flw_ref || txRef,
          reference: response.data?.tx_ref || txRef,
          flwRef: response.data?.flw_ref || txRef,
          status: response.data?.status || "pending",
          message: response.message || "Mobile money payment initiated",
          authorizationDetails: response.meta?.authorization && {
            mode: response.meta.authorization.mode,
            redirectUrl: response.meta.authorization.redirect,
          },
        };
      } else {
        throw new Error("Flutterwave payment failed");
      }
    }
  } catch (error: any) {
    console.log("Mobile money payment failed:", error);

    let errorMessage = "Mobile money payment processing failed";
    if (error.message.includes("Invalid") || error.message.includes("phone")) {
      errorMessage = "Invalid phone number format";
    } else if (error.message.includes("insufficient")) {
      errorMessage = "Insufficient balance";
    }

    return {
      success: false,
      transactionId: "",
      reference: "",
      flwRef: "",
      status: "failed",
      message: errorMessage,
      error: errorMessage,
      details: error.message,
    };
  }
}

/**
 * Process Card Payment
 */
async function processCardPayment({
  amount,
  txRef,
  email,
  fullname,
  phoneNumber,
  currency = "RWF",
  cardDetails,
}: {
  amount: number;
  txRef: string;
  email: string;
  fullname: string;
  phoneNumber: string;
  currency?: string;
  cardDetails: {
    cardNumber: string;
    cvv: string;
    expiryMonth: string;
    expiryYear: string;
    pin?: string;
  };
}): Promise<CardPaymentResult> {
  try {
    console.log(`Processing card payment: ${amount} ${currency} for ${email}`);

    const payload = {
      card_number: cardDetails.cardNumber,
      cvv: cardDetails.cvv,
      expiry_month: cardDetails.expiryMonth,
      expiry_year: cardDetails.expiryYear,
      currency: currency,
      amount: amount.toString(),
      redirect_url: `${process.env.CLIENT_PRODUCTION_URL}/restaurant/confirmation`,
      fullname: fullname,
      email: email,
      phone_number: phoneNumber,
      enckey: process.env.FLW_ENCRYPTION_KEY,
      tx_ref: txRef,
    };

    // Add PIN if provided
    if (cardDetails.pin) {
      (payload as any).authorization = {
        mode: "pin",
        pin: cardDetails.pin,
      };
    }

    const response = await flw.Charge.card(payload);
    console.log("Card Payment Response:", response);

    if (response.status === "success") {
      let authorizationDetails:
        | { mode: string; redirectUrl: string; message?: string }
        | undefined = undefined;

      // Handle different authorization modes
      if (response.meta?.authorization?.mode === "pin") {
        authorizationDetails = {
          mode: "pin",
          redirectUrl: "",
          message: "Please enter your card PIN",
        };
      } else if (response.meta?.authorization?.mode === "redirect") {
        authorizationDetails = {
          mode: "redirect",
          redirectUrl: response.meta.authorization.redirect,
          message: "Redirecting to bank for authorization",
        };
      } else if (response.meta?.authorization?.mode === "otp") {
        authorizationDetails = {
          mode: "otp",
          redirectUrl: response.meta.authorization.endpoint,
          message: "Please enter the OTP sent to your phone/email",
        };
      }

      // Update order to indicate fallback to Flutterwave
      await prisma.order.update({
        where: { txRef: txRef },
        data: {
          paymentType: "FLUTTERWAVE_CARD",
          paymentProvider: "FLUTTERWAVE",
        },
      });
      return {
        success: true,
        transactionId:
          response.data?.id?.toString() || response.data?.flw_ref || txRef,
        reference: response.data?.tx_ref || txRef,
        flwRef: response.data?.flw_ref || txRef,
        status: response.data?.status || "pending",
        message: response.message || "Card payment initiated",
        authorizationDetails,
        // Additional data to store in database
        cardPaymentData: {
          transactionId: response.data?.id,
          flwRef: response.data?.flw_ref,
          deviceFingerprint: response.data?.device_fingerprint,
          amount: response.data?.amount,
          chargedAmount: response.data?.charged_amount,
          appFee: response.data?.app_fee,
          merchantFee: response.data?.merchant_fee,
          processorResponse: response.data?.processor_response,
          authModel: response.data?.auth_model,
          currency: response.data?.currency,
          ip: response.data?.ip,
          narration: response.data?.narration,
          status: response.data?.status,
          authUrl: response.data?.auth_url,
          paymentType: response.data?.payment_type,
          fraudStatus: response.data?.fraud_status,
          chargeType: response.data?.charge_type,
          // Card specific data
          cardFirst6Digits: response.data?.card?.first_6digits,
          cardLast4Digits: response.data?.card?.last_4digits,
          cardCountry: response.data?.card?.country,
          cardType: response.data?.card?.type,
          cardExpiry: response.data?.card?.expiry,
          // Customer data
          customerId: response.data?.customer?.id,
          customerName: response.data?.customer?.name,
          customerEmail: response.data?.customer?.email,
          customerPhone: response.data?.customer?.phone_number,
        },
      };
    } else {
      return {
        success: false,
        error: response.message || "Card payment initialization failed",
        transactionId: "",
        reference: "",
        flwRef: "",
        status: "failed",
        message: "Card payment initialization failed",
      };
    }
  } catch (error: any) {
    console.log("Card payment failed:", error.message);
    return {
      success: false,
      error: "Card payment processing failed: " + error.message,
      details: error.message,
      transactionId: "",
      reference: "",
      flwRef: "",
      status: "failed",
      message: "Card payment processing failed: " + error.message,
    };
  }
}

/**
 * Process Bank Transfer
 */
async function processBankTransfer({
  amount,
  txRef,
  email,
  phoneNumber,
  currency = "RWF",
  clientIp = "127.0.0.1",
  deviceFingerprint = "62wd23423rq324323qew1",
  narration = "Order payment",
}: {
  amount: number;
  txRef: string;
  email: string;
  phoneNumber: string;
  currency?: string;
  clientIp?: string;
  deviceFingerprint?: string;
  narration?: string;
}): Promise<BankTransferPaymentResult> {
  try {
    console.log(`Processing bank transfer: ${amount} ${currency} for ${email}`);

    const payload = {
      tx_ref: txRef,
      amount: amount.toString(),
      email: email,
      phone_number: phoneNumber,
      currency: currency,
      client_ip: clientIp,
      device_fingerprint: deviceFingerprint,
      narration: narration,
      redirect_url: `${process.env.CLIENT_PRODUCTION_URL}/restaurant/confirmation`,
      is_permanent: false,
      expires: 3600, // 1 hour expiration
    };

    const response = await flw.Charge.bank_transfer(payload);
    console.log("Bank Transfer Response:", response);

    if (response.status === "success") {
      const transferDetails = response.meta?.authorization && {
        transferReference: response.meta.authorization.transfer_reference,
        transferAccount: response.meta.authorization.transfer_account,
        transferBank: response.meta.authorization.transfer_bank,
        transferAmount: parseFloat(
          response.meta.authorization.transfer_amount || "0"
        ),
        transferNote: response.meta.authorization.transfer_note,
        accountExpiration: response.meta.authorization.account_expiration
          ? new Date(response.meta.authorization.account_expiration)
          : null,
      };

      // Update order to indicate fallback to Flutterwave
      await prisma.order.update({
        where: { txRef: txRef },
        data: {
          paymentType: "FLUTTERWAVE_BANK_TRANSFER",
          paymentProvider: "FLUTTERWAVE",
        },
      });

      return {
        success: true,
        transactionId: response.data?.flw_ref || txRef,
        reference: response.data?.tx_ref || txRef,
        flwRef: response.data?.flw_ref || txRef,
        status: response.data?.status || "pending",
        message: response.message || "Bank transfer initiated",
        transferDetails,
      };
    } else {
      return {
        success: false,
        transactionId: "",
        reference: "",
        flwRef: "",
        status: "failed",
        message: response.message || "Bank transfer initialization failed",
        error: response.message || "Bank transfer initialization failed",
      };
    }
  } catch (error: any) {
    console.log("Bank transfer failed:", error);
    return {
      success: false,
      transactionId: "",
      reference: "",
      flwRef: "",
      status: "failed",
      message: "Bank transfer initialization failed  " + error.message,
      error: "Bank transfer initialization failed  " + error.message,
    };
  }
}
