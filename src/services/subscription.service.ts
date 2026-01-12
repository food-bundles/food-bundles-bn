import dotenv from "dotenv";
import prisma from "../prisma";
import { SubscriptionStatus, PaymentStatus } from "@prisma/client";
import { retryDatabaseOperation } from "../utils/db-retry.utls";
import { sendMessage } from "../utils/sms.utility";
import { cleanPhoneNumber, isValidRwandaPhone } from "../utils/emailTemplates";
import { createNotificationService } from "./notification.services";
import { sendSubscriptionExpiryEmail } from "../utils/emailTemplates";

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

// Types for payment results
interface SubscriptionPaymentResult {
  success: boolean;
  transactionId: string;
  reference: string;
  flwRef: string;
  status: string;
  message: string;
  error?: string;
  authorizationDetails?: {
    mode: string;
    redirectUrl: string;
    message?: string;
  };
  transferDetails?: {
    transferReference: string;
    transferAccount: string;
    transferBank: string;
    transferAmount: number;
    transferNote: string;
    accountExpiration: Date | null;
  };
  cardPaymentData?: any;
}

interface CreateSubscriptionPlanData {
  name: string;
  description?: string;
  price: number;
  duration: number;
  features?: string[];
  voucherAccess?: boolean;
  voucherPaymentDays?: number;
  freeDelivery?: boolean;
  stablePricing?: boolean;
  receiveEBM?: boolean;
  advertisingAccess?: boolean;
  otherServices?: boolean;
}

interface UpdateSubscriptionPlanData {
  name?: string;
  description?: string;
  price?: number;
  duration?: number;
  features?: any;
  isActive?: boolean;
  voucherAccess?: boolean;
  voucherPaymentDays?: number;
  freeDelivery?: boolean;
  stablePricing?: boolean;
  receiveEBM?: boolean;
  advertisingAccess?: boolean;
  otherServices?: boolean;
}

interface CreateRestaurantSubscriptionData {
  restaurantId: string;
  planId: string;
  autoRenew?: boolean;
  paymentMethod?: string;
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
}

interface UpdateRestaurantSubscriptionData {
  status?: SubscriptionStatus;
  autoRenew?: boolean;
  endDate?: Date;
}

/**
 * Service to create a new subscription plan
 */
export const createSubscriptionPlanService = async (
  data: CreateSubscriptionPlanData
) => {
  const {
    name,
    description,
    price,
    duration,
    features,
    voucherAccess,
    voucherPaymentDays,
    freeDelivery,
    stablePricing,
    receiveEBM,
    advertisingAccess,
    otherServices,
  } = data;

  const existingPlan = await prisma.subscriptionPlan.findUnique({
    where: { name },
  });

  if (existingPlan) {
    throw new Error("Subscription plan with this name already exists");
  }

  if (price <= 0) {
    throw new Error("Price must be greater than 0");
  }

  if (duration <= 0) {
    throw new Error("Duration must be greater than 0");
  }

  // Validate voucherPaymentDays if voucherAccess is enabled
  if (voucherAccess && voucherPaymentDays && voucherPaymentDays <= 0) {
    throw new Error("Voucher payment days must be greater than 0");
  }

  const plan = await prisma.subscriptionPlan.create({
    data: {
      name,
      description,
      price,
      duration,
      features,
      voucherAccess,
      voucherPaymentDays,
      freeDelivery,
      stablePricing,
      receiveEBM,
      advertisingAccess,
      otherServices,
    },
  });

  return plan;
};
/**
 * Helper function to check and update subscription expiry
 */
const checkAndUpdateSubscriptionExpiry = async (subscription: any) => {
  const now = new Date();

  if (
    subscription.status === SubscriptionStatus.ACTIVE &&
    subscription.endDate &&
    now > new Date(subscription.endDate)
  ) {
    const updatedSubscription = await prisma.restaurantSubscription.update({
      where: { id: subscription.id },
      data: { status: SubscriptionStatus.EXPIRED },
    });

    // Send expiry notification only once (when status changes from ACTIVE to EXPIRED)
    try {
      await sendMessage(
        `Dear ${subscription.restaurant?.name || ""}, Your subscription ${
          subscription.plan.name
        } has expired. Please renew your subscription to continue using our services. Thank you!`,
        subscription.restaurant?.phone || ""
      );
    } catch (error) {
      console.error("Failed to send subscription notification:", error);
    }

    try {
      await sendSubscriptionExpiryEmail({
        email: subscription.restaurant?.email || "",
        restaurantName: subscription.restaurant?.name || "Restaurant",
        planName: subscription.plan?.name || "Plan",
        endDate: subscription.endDate,
      });
    } catch (error) {
      console.error("Failed to send subscription expiry email:", error);
    }

    return updatedSubscription;
  }

  // Check if subscription is about to expire (3 days before) - only for ACTIVE subscriptions
  if (
    subscription.status === SubscriptionStatus.ACTIVE &&
    subscription.endDate
  ) {
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const daysUntilExpiry = Math.ceil(
      (new Date(subscription.endDate).getTime() - now.getTime()) /
        (1000 * 60 * 60 * 24)
    );

    // Send warning only when exactly 3 days remain (prevents multiple sends)

    if (daysUntilExpiry === 3) {
      try {
        await sendMessage(
          `Dear ${subscription.restaurant?.name || ""}, Your subscription ${
            subscription.plan.name
          } is about to expire in 3 days. Please renew your subscription to continue using our services. Thank you!`,
          subscription.restaurant?.phone || ""
        );
      } catch (error) {
        console.error("Failed to send subscription notification:", error);
      }

      try {
        await sendSubscriptionExpiryEmail({
          email: subscription.restaurant?.email || "",
          restaurantName: subscription.restaurant?.name || "Restaurant",
          planName: subscription.plan?.name || "Plan",
          endDate: subscription.endDate,
          isWarning: true,
        });
      } catch (error) {
        console.error("Failed to send subscription warning email:", error);
      }
    }
  }

  return subscription;
};

/**
 * Service to get all subscription plans
 */
export const getAllSubscriptionPlansService = async ({
  page = 1,
  limit = 10,
  isActive,
}: {
  page?: number;
  limit?: number;
  isActive?: boolean;
}) => {
  const skip = (page - 1) * limit;

  const where: any = {};
  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  const [plans, total] = await Promise.all([
    prisma.subscriptionPlan.findMany({
      where,
      skip,
      take: limit,
      include: {
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.subscriptionPlan.count({ where }),
  ]);

  return {
    plans,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Service to get subscription plan by ID
 */
export const getSubscriptionPlanByIdService = async (planId: string) => {
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id: planId },
    include: {
      _count: {
        select: {
          subscriptions: true,
        },
      },
    },
  });

  if (!plan) {
    throw new Error("Subscription plan not found");
  }

  return plan;
};

/**
 * Service to update subscription plan
 */
export const updateSubscriptionPlanService = async (
  planId: string,
  data: UpdateSubscriptionPlanData
) => {
  const existingPlan = await prisma.subscriptionPlan.findUnique({
    where: { id: planId },
  });

  if (!existingPlan) {
    throw new Error("Subscription plan not found");
  }

  if (data.name && data.name !== existingPlan.name) {
    const nameConflict = await prisma.subscriptionPlan.findUnique({
      where: { name: data.name },
    });

    if (nameConflict) {
      throw new Error("Subscription plan with this name already exists");
    }
  }

  if (data.price !== undefined && data.price <= 0) {
    throw new Error("Price must be greater than 0");
  }

  if (data.duration !== undefined && data.duration <= 0) {
    throw new Error("Duration must be greater than 0");
  }

  // Validate voucherPaymentDays if voucherAccess is being enabled
  if (
    data.voucherAccess &&
    data.voucherPaymentDays !== undefined &&
    data.voucherPaymentDays <= 0
  ) {
    throw new Error("Voucher payment days must be greater than 0");
  }

  const updatedPlan = await prisma.subscriptionPlan.update({
    where: { id: planId },
    data,
  });

  return updatedPlan;
};
/**
 * Service to delete subscription plan
 */
export const deleteSubscriptionPlanService = async (planId: string) => {
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id: planId },
    include: {
      subscriptions: {
        where: {
          status: "ACTIVE",
        },
      },
    },
  });

  if (!plan) {
    throw new Error("Subscription plan not found");
  }

  if (plan.subscriptions.length > 0) {
    throw new Error("Cannot delete plan with active subscriptions");
  }

  // Delete all restaurant subscriptions associated with the plan
  await prisma.restaurantSubscription.deleteMany({
    where: { planId },
  });

  await prisma.subscriptionPlan.delete({
    where: { id: planId },
  });

  return { message: "Subscription plan deleted successfully" };
};

/**
 * Service to create or update restaurant subscription with payment processing
 * Similar to cart pattern - one subscription per restaurant that gets updated
 */
export const createRestaurantSubscriptionService = async (
  data: CreateRestaurantSubscriptionData
) => {
  const {
    restaurantId,
    planId,
    autoRenew = true,
    paymentMethod,
    phoneNumber,
    cardDetails,
    bankDetails,
  } = data;

  // Validate restaurant exists
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
  });

  if (!restaurant) {
    throw new Error("Restaurant not found");
  }

  // Validate plan exists and is active
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id: planId },
  });

  if (!plan) {
    throw new Error("Subscription plan not found");
  }

  if (!plan.isActive) {
    throw new Error("Subscription plan is not active");
  }

  // Find existing subscription for this restaurant (any status)
  let existingSubscription = await prisma.restaurantSubscription.findFirst({
    where: {
      restaurantId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Check if restaurant has an active subscription with different plan
  if (existingSubscription?.status === "ACTIVE" && existingSubscription.planId !== planId) {
    // This is an upgrade/downgrade - we'll update the existing subscription
    console.log("Upgrading/downgrading existing subscription");
  } else if (existingSubscription?.status === "ACTIVE" && existingSubscription.planId === planId) {
    throw new Error("You already have an active subscription with this plan");
  }

  // Calculate end date
  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + plan.duration);

  // Generate transaction reference
  const txRef = `SUB_${restaurantId}_${planId}_${Date.now()}`;

  let subscription;
  let isUpgrade = false;
  let isDowngrade = false;
  let oldPlanId: string | undefined;

  if (existingSubscription) {
    // Update existing subscription
    const oldPlan = await prisma.subscriptionPlan.findUnique({
      where: { id: existingSubscription.planId },
    });
    
    isUpgrade = oldPlan ? plan.price > oldPlan.price : false;
    isDowngrade = oldPlan ? plan.price < oldPlan.price : false;
    oldPlanId = existingSubscription.planId;

    subscription = await prisma.$transaction(async (tx) => {
      const updatedSubscription = await tx.restaurantSubscription.update({
        where: { id: existingSubscription.id },
        data: {
          planId,
          status: SubscriptionStatus.PENDING,
          startDate,
          endDate,
          autoRenew,
          paymentMethod: paymentMethod || "MOBILE_MONEY",
          paymentStatus: PaymentStatus.PENDING,
          txRef,
          flwRef: txRef,
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

      // Create subscription history
      await tx.subscriptionHistory.create({
        data: {
          subscriptionId: updatedSubscription.id,
          action: isUpgrade ? "UPGRADED" : isDowngrade ? "DOWNGRADED" : "RENEWED",
          oldStatus: existingSubscription.status,
          newStatus: "PENDING",
          oldPlanId,
          newPlanId: planId,
          performedBy: restaurantId,
        },
      });

      return updatedSubscription;
    });
  } else {
    // Create new subscription
    subscription = await prisma.$transaction(async (tx) => {
      const newSubscription = await tx.restaurantSubscription.create({
        data: {
          restaurantId,
          planId,
          status: SubscriptionStatus.PENDING,
          startDate,
          endDate,
          autoRenew,
          paymentMethod: paymentMethod || "MOBILE_MONEY",
          paymentStatus: PaymentStatus.PENDING,
          txRef,
          flwRef: txRef,
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

      // Create subscription history
      await tx.subscriptionHistory.create({
        data: {
          subscriptionId: newSubscription.id,
          action: "CREATED",
          newStatus: "PENDING",
          newPlanId: planId,
          performedBy: restaurantId,
        },
      });

      return newSubscription;
    });
  }

  // Process payment if payment method is provided
  if (paymentMethod && paymentMethod !== "CASH") {
    const paymentResult = await processSubscriptionPaymentService(
      subscription.id,
      {
        paymentMethod,
        phoneNumber,
        cardDetails,
        bankDetails,
      }
    );

    return {
      subscription,
      payment: paymentResult,
      isUpgrade,
      isDowngrade,
    };
  }

  return { 
    subscription, 
    isUpgrade, 
    isDowngrade 
  };
};

/**
 * Service to process subscription payment
 */
export const processSubscriptionPaymentService = async (
  subscriptionId: string,
  paymentData: {
    paymentMethod: string;
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
  }
) => {
  // Get subscription with retry logic
  let subscription: any;

  try {
    subscription = await retryDatabaseOperation(async () => {
      return await prisma.restaurantSubscription.findUnique({
        where: { id: subscriptionId },
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

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    if (subscription.paymentStatus === "COMPLETED") {
      throw new Error("Payment already completed");
    }
  } catch (error: any) {
    console.log("Error in initial subscription operations:", error);
    if (error.message.includes("timeout") || error.code === "P1017") {
      throw new Error("Database connection issue. Please try again.");
    }
    throw error;
  }

  // Update payment status to processing
  try {
    await retryDatabaseOperation(async () => {
      return await prisma.restaurantSubscription.update({
        where: { id: subscriptionId },
        data: {
          paymentStatus: PaymentStatus.PROCESSING,
          paymentMethod: paymentData.paymentMethod,
        },
      });
    });
  } catch (error: any) {
    console.log("Error updating subscription to processing:", error);
  }

  try {
    let paymentResult: SubscriptionPaymentResult;

    switch (paymentData.paymentMethod) {
      case "MOBILE_MONEY":
        if (!paymentData.phoneNumber) {
          throw new Error("Phone number is required for mobile money payment");
        }
        paymentResult = await processSubscriptionMobileMoneyPayment({
          amount: subscription.plan.price,
          phoneNumber: paymentData.phoneNumber,
          txRef: subscription.txRef!,
          email: subscription.restaurant?.email,
          fullname: subscription.restaurant?.name || "",
          currency: "RWF",
        });
        break;

      case "CARD":
        paymentResult = await processSubscriptionCardPayment({
          amount: subscription.plan.price,
          txRef: subscription.txRef!,
          email: subscription.restaurant?.email,
          fullname: subscription.restaurant?.name || "",
          phoneNumber:
            paymentData.phoneNumber || subscription.restaurant?.phone || "",
          currency: "RWF",
          cardDetails: paymentData.cardDetails,
        });
        break;

      case "BANK_TRANSFER":
        paymentResult = await processSubscriptionBankTransfer({
          amount: subscription.plan.price,
          txRef: subscription.txRef!,
          email: subscription.restaurant?.email,
          phoneNumber:
            paymentData.phoneNumber || subscription.restaurant?.phone || "",
          currency: "RWF",
          clientIp: paymentData.bankDetails?.clientIp || "",
          narration: `Subscription payment for ${subscription.plan.name}`,
        });
        break;

      default:
        throw new Error("Unsupported payment method");
    }

    // Handle payment result
    if (paymentResult.success) {
      const updateData: any = {
        paymentStatus:
          paymentResult.status === "successful"
            ? PaymentStatus.COMPLETED
            : PaymentStatus.PROCESSING,
        transactionId: paymentResult.transactionId,
        flwRef: paymentResult.flwRef,
        status:
          paymentResult.status === "successful"
            ? SubscriptionStatus.ACTIVE
            : SubscriptionStatus.PENDING,
      };

      // Update subscription with payment details
      await retryDatabaseOperation(async () => {
        return await prisma.restaurantSubscription.update({
          where: { id: subscriptionId },
          data: updateData,
        });
      });

      // Create subscription history entry
      if (paymentResult.status === "successful") {
        await retryDatabaseOperation(async () => {
          return await prisma.subscriptionHistory.create({
            data: {
              subscriptionId,
              action: "CREATED",
              newStatus: "ACTIVE",
              reason: "Payment completed successfully",
            },
          });
        });

        // Send success notification
        try {
          await sendMessage(
            `Dear ${
              subscription.restaurant?.name || ""
            }, Your subscription to ${
              subscription.plan.name
            } has been activated successfully. Thank you!`,
            subscription.restaurant?.phone || ""
          );
        } catch (error) {
          console.error("Failed to send subscription notification:", error);
        }
      }

      return {
        success: true,
        subscription,
        transactionId: paymentResult.transactionId,
        redirectUrl: paymentResult.authorizationDetails?.redirectUrl,
        transferDetails: paymentResult.transferDetails,
        status: paymentResult.status,
        message: paymentResult.message,
      };
    } else {
      // Handle failed payment
      await retryDatabaseOperation(async () => {
        return await prisma.restaurantSubscription.update({
          where: { id: subscriptionId },
          data: {
            paymentStatus: PaymentStatus.FAILED,
            status: SubscriptionStatus.CANCELLED,
          },
        });
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
        console.error("Failed to send failure notification:", error);
      }

      return {
        success: false,
        error: paymentResult.error || "Payment failed",
      };
    }
  } catch (error: any) {
    console.log("Error processing subscription payment:", error);

    // Update subscription to failed status
    try {
      await retryDatabaseOperation(async () => {
        return await prisma.restaurantSubscription.update({
          where: { id: subscriptionId },
          data: {
            paymentStatus: PaymentStatus.FAILED,
            status: SubscriptionStatus.CANCELLED,
          },
        });
      });
    } catch (updateError) {
      console.log("Error updating payment failure status:", updateError);
    }

    throw new Error(`Payment processing failed: ${error.message}`);
  }
};

/**
 * Process Mobile Money Payment for Subscription
 */
async function processSubscriptionMobileMoneyPayment({
  amount,
  phoneNumber,
  txRef,
  email,
  fullname,
  currency = "RWF",
}: {
  amount: number;
  phoneNumber: string;
  txRef: string;
  email: string;
  fullname: string;
  currency?: string;
}): Promise<SubscriptionPaymentResult> {
  try {
    const cleanedPhoneNumber = cleanPhoneNumber(phoneNumber);

    if (!isValidRwandaPhone(cleanedPhoneNumber)) {
      throw new Error(
        "Invalid mobile number. Please use format: 078XXXXXXX, 079XXXXXXX, 072XXXXXXX, or 073XXXXXXX"
      );
    }

    console.log(
      `Processing subscription mobile money payment: ${amount} ${currency}`
    );

    // Try PayPack first
    try {
      const response = await paypack.cashin({
        number: cleanedPhoneNumber,
        amount: amount,
        environment:
          process.env.NODE_ENV === "production" ? "production" : "development",
      });

      if (response && response.data) {
        // Update subscription with PayPack reference
        await prisma.restaurantSubscription.update({
          where: { txRef: txRef },
          data: {
            flwRef: response.data.ref || txRef,
            transactionId: response.data.ref || txRef,
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
      console.log("PayPack payment failed, falling back to Flutterwave...");

      const payload = {
        tx_ref: txRef,
        order_id: txRef,
        amount: amount.toString(),
        currency: currency,
        email: email,
        phone_number: cleanedPhoneNumber,
        fullname: fullname,
        redirect_url: `${process.env.CLIENT_PRODUCTION_URL}/restaurant/subscribe`,
      };

      const response = await flw.MobileMoney.rwanda(payload);

      if (response.status === "success") {
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
    return {
      success: false,
      transactionId: "",
      reference: "",
      flwRef: "",
      status: "failed",
      message: "Mobile money payment processing failed",
      error: error.message,
    };
  }
}

/**
 * Process Card Payment for Subscription
 */
async function processSubscriptionCardPayment({
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
  cardDetails?: any;
}): Promise<SubscriptionPaymentResult> {
  try {
    console.log(`Processing subscription card payment: ${amount} ${currency}`);

    const standardPayload = {
      tx_ref: txRef,
      amount: amount.toString(),
      currency: currency,
      redirect_url: `${process.env.CLIENT_PRODUCTION_URL}/restaurant/subscribe`,
      customer: {
        email: email,
        name: fullname,
        phonenumber: phoneNumber,
      },
      customizations: {
        title: "Subscription Payment",
        description: `Subscription payment - ${txRef}`,
        logo: `https://res.cloudinary.com/dzxyelclu/image/upload/v1760111270/Food_bundle_logo_cfsnsw.png`,
      },
      payment_options: "card",
      meta: {
        subscription_ref: txRef,
        payment_method: "CARD",
      },
    };

    const axios = require("axios");
    const standardResponse = await axios.post(
      "https://api.flutterwave.com/v3/payments",
      standardPayload,
      {
        headers: {
          Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (
      standardResponse.data?.status === "success" &&
      standardResponse.data?.data?.link
    ) {
      return {
        success: true,
        transactionId: txRef,
        reference: txRef,
        flwRef: txRef,
        status: "pending",
        message: "Redirect to complete card payment",
        authorizationDetails: {
          mode: "redirect",
          redirectUrl: standardResponse.data.data.link,
          message: "Redirecting to Flutterwave secure checkout",
        },
      };
    } else {
      throw new Error("Flutterwave payment link generation failed");
    }
  } catch (error: any) {
    console.log("Card payment failed:", error.message);
    return {
      success: false,
      error: "Card payment processing failed: " + error.message,
      transactionId: "",
      reference: "",
      flwRef: "",
      status: "failed",
      message: "Card payment processing failed",
    };
  }
}

/**
 * Process Bank Transfer for Subscription
 */
async function processSubscriptionBankTransfer({
  amount,
  txRef,
  email,
  phoneNumber,
  currency = "RWF",
  clientIp,
  narration,
}: {
  amount: number;
  txRef: string;
  email: string;
  phoneNumber: string;
  currency?: string;
  clientIp?: string;
  narration?: string;
}): Promise<SubscriptionPaymentResult> {
  try {
    console.log(`Processing subscription bank transfer: ${amount} ${currency}`);

    const payload = {
      tx_ref: txRef,
      amount: amount.toString(),
      email: email,
      phone_number: phoneNumber,
      currency: currency,
      client_ip: clientIp,
      device_fingerprint: "62wd23423rq324323qew1",
      narration: narration || "Subscription payment",
      redirect_url: `${process.env.CLIENT_PRODUCTION_URL}/restaurant/subscribe`,
      is_permanent: false,
      expires: 3600,
    };

    const response = await flw.Charge.bank_transfer(payload);

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
        message: "Bank transfer initialization failed",
        error: response.message,
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
      message: "Bank transfer initialization failed",
      error: error.message,
    };
  }
}

export const getRestaurantSubscriptionsService = async (
  restaurantId: string,
  filters?: {
    page?: number;
    limit?: number;
    status?: SubscriptionStatus;
  }
) => {
  const { page = 1, limit = 10, status } = filters || {};
  const skip = (page - 1) * limit;

  const where: any = { restaurantId };
  if (status) {
    where.status = status;
  }

  const [subscriptions, total] = await Promise.all([
    prisma.restaurantSubscription.findMany({
      where,
      skip,
      take: limit,
      include: {
        plan: true,
        restaurant: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.restaurantSubscription.count({ where }),
  ]);

  // Check and update subscription expiry
  const updatedSubscriptions = await Promise.all(
    subscriptions.map((subscription) =>
      checkAndUpdateSubscriptionExpiry(subscription)
    )
  );

  // Add daysRemaining to each subscription
  const subscriptionsWithDaysRemaining = updatedSubscriptions.map((sub) => ({
    ...sub,
    daysRemaining: calculateDaysRemaining(sub.endDate),
  }));

  return {
    subscriptions: subscriptionsWithDaysRemaining,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

export const getSubscriptionByIdService = async (
  subscriptionId: string,
  restaurantId?: string
) => {
  const subscription = await prisma.restaurantSubscription.findUnique({
    where: { id: subscriptionId },
    include: {
      plan: true,
      restaurant: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
      payments: {
        orderBy: {
          createdAt: "desc",
        },
      },
      history: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!subscription) {
    throw new Error("Subscription not found");
  }

  if (restaurantId && subscription.restaurantId !== restaurantId) {
    throw new Error(
      "Unauthorized: Subscription does not belong to this restaurant"
    );
  }

  // Check and update subscription expiry
  const updatedSubscription = await checkAndUpdateSubscriptionExpiry(
    subscription
  );

  // Add daysRemaining to subscription
  return {
    ...updatedSubscription,
    daysRemaining: calculateDaysRemaining(updatedSubscription.endDate),
  };
};

export const updateRestaurantSubscriptionService = async (
  subscriptionId: string,
  data: UpdateRestaurantSubscriptionData,
  restaurantId?: string
) => {
  const existingSubscription = await getSubscriptionByIdService(
    subscriptionId,
    restaurantId
  );

  const oldStatus = existingSubscription.status;

  const updatedSubscription = await prisma.$transaction(async (tx) => {
    const updated = await tx.restaurantSubscription.update({
      where: { id: subscriptionId },
      data,
      include: {
        plan: true,
        restaurant: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (data.status && data.status !== oldStatus) {
      let action: any = "CREATED";
      if (data.status === "ACTIVE" && oldStatus === "SUSPENDED") {
        action = "REACTIVATED";
      } else if (data.status === "CANCELLED") {
        action = "CANCELLED";
      } else if (data.status === "SUSPENDED") {
        action = "SUSPENDED";
      } else if (data.status === "EXPIRED") {
        action = "EXPIRED";
      }

      await tx.subscriptionHistory.create({
        data: {
          subscriptionId,
          action,
          oldStatus,
          newStatus: data.status,
        },
      });
    }

    return updated;
  });

  return updatedSubscription;
};

export const cancelSubscriptionService = async (
  restaurantId: string,
  reason?: string
) => {
  // Get current subscription
  const currentSubscription = await prisma.restaurantSubscription.findFirst({
    where: {
      restaurantId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!currentSubscription) {
    throw new Error("No subscription found for this restaurant");
  }

  if (currentSubscription.status === "CANCELLED") {
    throw new Error("Subscription is already cancelled");
  }

  const updatedSubscription = await prisma.$transaction(async (tx) => {
    const updated = await tx.restaurantSubscription.update({
      where: { id: currentSubscription.id },
      data: {
        status: "CANCELLED",
        autoRenew: false,
      },
    });

    await tx.subscriptionHistory.create({
      data: {
        subscriptionId: currentSubscription.id,
        action: "CANCELLED",
        oldStatus: currentSubscription.status,
        newStatus: "CANCELLED",
        reason,
      },
    });

    return updated;
  });

  return updatedSubscription;
};

export const renewSubscriptionService = async (
  restaurantId: string
) => {
  // Get current subscription
  const currentSubscription = await prisma.restaurantSubscription.findFirst({
    where: {
      restaurantId,
    },
    include: {
      plan: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!currentSubscription) {
    throw new Error("No subscription found for this restaurant");
  }

  if (currentSubscription.status === "ACTIVE") {
    throw new Error("Subscription is already active");
  }

  const plan = currentSubscription.plan;

  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + plan.duration);

  const renewedSubscription = await prisma.$transaction(async (tx) => {
    const renewed = await tx.restaurantSubscription.update({
      where: { id: currentSubscription.id },
      data: {
        status: SubscriptionStatus.PENDING,
        startDate,
        endDate,
        paymentStatus: PaymentStatus.PENDING,
        txRef: `SUB_RENEW_${restaurantId}_${Date.now()}`,
      },
      include: {
        plan: true,
        restaurant: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    await tx.subscriptionHistory.create({
      data: {
        subscriptionId: currentSubscription.id,
        action: "RENEWED",
        oldStatus: currentSubscription.status,
        newStatus: "PENDING",
      },
    });

    return renewed;
  });

  return renewedSubscription;
};

export const getAllSubscriptionsService = async ({
  page = 1,
  limit = 10,
  status,
  restaurantId,
}: {
  page?: number;
  limit?: number;
  status?: SubscriptionStatus;
  restaurantId?: string;
}) => {
  const skip = (page - 1) * limit;

  const where: any = {};
  if (status) where.status = status;
  if (restaurantId) where.restaurantId = restaurantId;

  const [subscriptions, total] = await Promise.all([
    prisma.restaurantSubscription.findMany({
      where,
      skip,
      take: limit,
      include: {
        plan: true,
        restaurant: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.restaurantSubscription.count({ where }),
  ]);

  // Check and update subscription expiry
  const updatedSubscriptions = await Promise.all(
    subscriptions.map((subscription) =>
      checkAndUpdateSubscriptionExpiry(subscription)
    )
  );

  // Add daysRemaining to each subscription
  const subscriptionsWithDaysRemaining = updatedSubscriptions.map((sub) => ({
    ...sub,
    daysRemaining: calculateDaysRemaining(sub.endDate),
  }));

  return {
    subscriptions: subscriptionsWithDaysRemaining,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

export const checkExpiredSubscriptionsService = async () => {
  const now = new Date();

  const expiredSubscriptions = await prisma.restaurantSubscription.findMany({
    where: {
      status: "ACTIVE",
      endDate: {
        lte: now,
      },
    },
    include: {
      plan: true,
    },
  });

  for (const subscription of expiredSubscriptions) {
    await prisma.$transaction(async (tx) => {
      await tx.restaurantSubscription.update({
        where: { id: subscription.id },
        data: {
          status: "EXPIRED",
        },
      });

      await tx.subscriptionHistory.create({
        data: {
          subscriptionId: subscription.id,
          action: "EXPIRED",
          oldStatus: "ACTIVE",
          newStatus: "EXPIRED",
          reason: "Subscription period ended",
        },
      });

      await createNotificationService({
        title: "Subscription Expired",
        message: `Your ${subscription.plan.name} subscription has expired. Renew to continue enjoying premium features`,
        eventType: "SUBSCRIPTION_EXPIRED",
        targetType: "SPECIFIC_USER",
        targetId: subscription.restaurantId || "",
        metadata: {
          subscriptionId: subscription.id,
          planName: subscription.plan.name,
          expiredAt: subscription.endDate,
        },
      });
    });
  }

  return {
    message: `${expiredSubscriptions.length} subscriptions expired`,
    count: expiredSubscriptions.length,
  };
};

/**
 * Calculate days remaining in subscription
 */
function calculateDaysRemaining(endDate: Date): number {
  const now = new Date();
  const end = new Date(endDate);
  const diffTime = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
}
/**
 * Service to get restaurant's current subscription (similar to cart pattern)
 */
export const getRestaurantCurrentSubscriptionService = async (
  restaurantId: string
) => {
  const subscription = await prisma.restaurantSubscription.findFirst({
    where: {
      restaurantId,
    },
    include: {
      plan: true,
      restaurant: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!subscription) {
    return null;
  }

  // Check and update subscription expiry
  const updatedSubscription = await checkAndUpdateSubscriptionExpiry(
    subscription
  );

  // Add daysRemaining to subscription
  return {
    ...updatedSubscription,
    daysRemaining: calculateDaysRemaining(updatedSubscription.endDate),
  };
};

/**
 * Service to upgrade/downgrade current subscription
 */
export const changeSubscriptionPlanService = async (
  restaurantId: string,
  newPlanId: string
) => {
  // Get current subscription
  const currentSubscription = await prisma.restaurantSubscription.findFirst({
    where: {
      restaurantId,
    },
    include: {
      plan: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!currentSubscription) {
    throw new Error("No subscription found for this restaurant");
  }

  // Validate new plan exists
  const newPlan = await prisma.subscriptionPlan.findUnique({
    where: { id: newPlanId },
  });

  if (!newPlan) {
    throw new Error("New subscription plan not found");
  }

  if (!newPlan.isActive) {
    throw new Error("New subscription plan is not active");
  }

  if (currentSubscription.planId === newPlanId) {
    throw new Error("You are already subscribed to this plan");
  }

  const isUpgrade = newPlan.price > currentSubscription.plan.price;
  const isDowngrade = newPlan.price < currentSubscription.plan.price;

  // Calculate new end date based on new plan duration
  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + newPlan.duration);

  const updatedSubscription = await prisma.$transaction(async (tx) => {
    const updated = await tx.restaurantSubscription.update({
      where: { id: currentSubscription.id },
      data: {
        planId: newPlanId,
        status: SubscriptionStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        startDate,
        endDate,
        txRef: `SUB_${isUpgrade ? 'UPGRADE' : 'DOWNGRADE'}_${restaurantId}_${Date.now()}`,
      },
      include: {
        plan: true,
        restaurant: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    await tx.subscriptionHistory.create({
      data: {
        subscriptionId: currentSubscription.id,
        action: isUpgrade ? "UPGRADED" : "DOWNGRADED",
        oldStatus: currentSubscription.status,
        newStatus: "PENDING",
        oldPlanId: currentSubscription.planId,
        newPlanId: newPlanId,
      },
    });

    return updated;
  });

  return {
    subscription: updatedSubscription,
    isUpgrade,
    isDowngrade,
  };
};

/**
 * Service to get subscription history for a restaurant
 */
export const getRestaurantSubscriptionHistoryService = async (
  restaurantId: string,
  filters?: {
    page?: number;
    limit?: number;
  }
) => {
  const { page = 1, limit = 10 } = filters || {};
  const skip = (page - 1) * limit;

  // Get current subscription
  const currentSubscription = await prisma.restaurantSubscription.findFirst({
    where: {
      restaurantId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!currentSubscription) {
    return {
      history: [],
      total: 0,
      page,
      limit,
      totalPages: 0,
    };
  }

  const [history, total] = await Promise.all([
    prisma.subscriptionHistory.findMany({
      where: { subscriptionId: currentSubscription.id },
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.subscriptionHistory.count({ 
      where: { subscriptionId: currentSubscription.id } 
    }),
  ]);

  return {
    history,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};