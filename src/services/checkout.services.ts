const axios = require("axios");
import prisma from "../prisma";
import { PaymentMethod, PaymentStatus } from "@prisma/client";
import {
  sendPaymentNotificationEmail,
  cleanPhoneNumber,
  isValidRwandaPhone,
} from "../utils/emailTemplates";
import { createOrder } from "../utils/paypal";

// PayPack integration - Install: npm install paypack-js
const PaypackJs = require("paypack-js").default;
require("dotenv").config();

// Configure PayPack
const paypack = PaypackJs.config({
  client_id: process.env.PAYPACK_APPLICATION_ID!,
  client_secret: process.env.PAYPACK_APPLICATION_SECRET!,
  timeout: 30000, // 30 seconds timeout
});

// Interface for creating a checkout
interface CreateCheckoutData {
  cartId: string;
  restaurantId: string;
  paymentMethod: PaymentMethod;
  billingName?: string;
  billingEmail?: string;
  billingPhone?: string;
  billingAddress?: string;
  notes?: string;
  deliveryDate?: Date;
}

// Interface for updating checkout
interface UpdateCheckoutData {
  paymentMethod?: PaymentMethod;
  billingName?: string;
  billingEmail?: string;
  billingPhone?: string;
  billingAddress?: string;
  notes?: string;
  deliveryDate?: Date;
  paymentStatus?: PaymentStatus;
  paymentReference?: string;
  transactionId?: string;
}

/**
 * Service to create a new checkout from cart
 * Validates cart exists, has items, and belongs to restaurant
 */
export const createCheckoutService = async (data: CreateCheckoutData) => {
  const {
    cartId,
    restaurantId,
    paymentMethod,
    billingName,
    billingEmail,
    billingPhone,
    billingAddress,
    notes,
    deliveryDate,
  } = data;

  // Validate cart exists and belongs to restaurant
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: {
      cartItems: {
        include: {
          product: true,
        },
      },
      restaurant: true,
    },
  });

  if (!cart) {
    throw new Error("Cart not found");
  }

  if (cart.restaurantId !== restaurantId) {
    throw new Error("Unauthorized: Cart does not belong to this restaurant");
  }

  if (cart.status !== "ACTIVE") {
    throw new Error("Cart is not active");
  }

  if (cart.cartItems.length === 0) {
    throw new Error("Cart is empty");
  }

  // Validate all products are still available
  for (const item of cart.cartItems) {
    if (item.product.status !== "ACTIVE") {
      throw new Error(
        `Product ${item.product.productName} is no longer available`
      );
    }
    if (item.product.quantity < item.quantity) {
      throw new Error(
        `Insufficient stock for ${item.product.productName}. Available: ${item.product.quantity}, Required: ${item.quantity}`
      );
    }
  }

  // Check if checkout already exists for this cart
  const existingCheckout = await prisma.cHECKOUT.findUnique({
    where: { cartId },
  });

  if (existingCheckout) {
    throw new Error("Checkout already exists for this cart");
  }

  // Create checkout
  const checkout = await prisma.cHECKOUT.create({
    data: {
      cartId,
      restaurantId,
      totalAmount: cart.totalAmount,
      paymentMethod,
      billingName,
      billingEmail,
      billingPhone,
      billingAddress,
      notes,
      deliveryDate,
      paymentStatus: "PENDING",
    },
    include: {
      cart: {
        include: {
          cartItems: {
            include: {
              product: true,
            },
          },
        },
      },
      restaurant: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  // Update cart status to CHECKED_OUT
  await prisma.cart.update({
    where: { id: cartId },
    data: { status: "CHECKED_OUT" },
  });

  return checkout;
};

/**
 * Service to get checkout by ID
 */
export const getCheckoutByIdService = async (
  checkoutId: string,
  restaurantId?: string
) => {
  const checkout = await prisma.cHECKOUT.findUnique({
    where: { id: checkoutId },
    include: {
      cart: {
        include: {
          cartItems: {
            include: {
              product: true,
            },
          },
        },
      },
      restaurant: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
      order: true, // Include associated order if exists
    },
  });

  if (!checkout) {
    throw new Error("Checkout not found");
  }

  // If restaurantId is provided, verify ownership
  if (restaurantId && checkout.restaurantId !== restaurantId) {
    throw new Error(
      "Unauthorized: Checkout does not belong to this restaurant"
    );
  }

  return checkout;
};

/**
 * Service to get all checkouts for a restaurant
 */
export const getRestaurantCheckoutsService = async (
  restaurantId: string,
  {
    page = 1,
    limit = 10,
    status,
    paymentMethod,
  }: {
    page?: number;
    limit?: number;
    status?: PaymentStatus;
    paymentMethod?: PaymentMethod;
  }
) => {
  const skip = (page - 1) * limit;

  const where: any = { restaurantId };
  if (status) where.paymentStatus = status;
  if (paymentMethod) where.paymentMethod = paymentMethod;

  const [checkouts, total] = await Promise.all([
    prisma.cHECKOUT.findMany({
      where,
      skip,
      take: limit,
      include: {
        cart: {
          include: {
            _count: {
              select: {
                cartItems: true,
              },
            },
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.cHECKOUT.count({ where }),
  ]);

  return {
    checkouts,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Service to get all checkouts (Admin only)
 */
export const getAllCheckoutsService = async ({
  page = 1,
  limit = 10,
  status,
  paymentMethod,
}: {
  page?: number;
  limit?: number;
  status?: PaymentStatus;
  paymentMethod?: PaymentMethod;
}) => {
  const skip = (page - 1) * limit;

  const where: any = {};
  if (status) where.paymentStatus = status;
  if (paymentMethod) where.paymentMethod = paymentMethod;

  const [checkouts, total] = await Promise.all([
    prisma.cHECKOUT.findMany({
      where,
      skip,
      take: limit,
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        cart: {
          include: {
            _count: {
              select: {
                cartItems: true,
              },
            },
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.cHECKOUT.count({ where }),
  ]);

  return {
    checkouts,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Service to update checkout
 */
export const updateCheckoutService = async (
  checkoutId: string,
  data: UpdateCheckoutData,
  restaurantId?: string
) => {
  // First get the checkout to verify ownership
  const existingCheckout = await getCheckoutByIdService(
    checkoutId,
    restaurantId
  );

  // Don't allow updates if payment is already completed
  if (existingCheckout.paymentStatus === "COMPLETED") {
    throw new Error("Cannot update checkout after payment is completed");
  }

  const updatedCheckout = await prisma.cHECKOUT.update({
    where: { id: checkoutId },
    data: {
      ...data,
      updatedAt: new Date(),
      paidAt:
        data.paymentStatus === "COMPLETED"
          ? new Date()
          : existingCheckout.paidAt,
    },
    include: {
      cart: {
        include: {
          cartItems: {
            include: {
              product: true,
            },
          },
        },
      },
      restaurant: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
      order: true,
    },
  });

  return updatedCheckout;
};

/**
 * Service to cancel/delete checkout
 */
export const cancelCheckoutService = async (
  checkoutId: string,
  restaurantId?: string
) => {
  const checkout = await getCheckoutByIdService(checkoutId, restaurantId);

  if (checkout.paymentStatus === "COMPLETED") {
    throw new Error("Cannot cancel completed checkout");
  }

  if (checkout.order) {
    throw new Error("Cannot cancel checkout that has been converted to order");
  }

  // Delete checkout and revert cart status
  await prisma.$transaction([
    prisma.cHECKOUT.delete({
      where: { id: checkoutId },
    }),
    prisma.cart.update({
      where: { id: checkout.cartId },
      data: { status: "ACTIVE" },
    }),
  ]);

  return { message: "Checkout cancelled successfully" };
};

/**
 * Service to process payment for checkout
 * This would integrate with PayPack for Rwanda mobile money payments
 */
export const processPaymentService = async (
  checkoutId: string,
  paymentData: {
    paymentMethod: PaymentMethod;
    phoneNumber?: string; // For mobile money
    cardToken?: string; // For card payments
    bankAccount?: string; // For bank transfers
  }
) => {
  const checkout = await getCheckoutByIdService(checkoutId);

  if (checkout.paymentStatus === "COMPLETED") {
    throw new Error("Payment already completed");
  }

  // Update payment status to processing
  await updateCheckoutService(checkoutId, {
    paymentStatus: "PROCESSING",
    paymentMethod: paymentData.paymentMethod,
  });

  try {
    let paymentResult;

    // Process different payment methods
    switch (paymentData.paymentMethod) {
      case "MOBILE_MONEY":
        // Integrate with PayPack API for Rwanda
        paymentResult = await processMobileMoneyPayment({
          amount: checkout.totalAmount,
          phoneNumber: paymentData.phoneNumber!,
          reference: `CHECKOUT_${checkoutId}`,
        });
        break;

      case "CARD":
        paymentResult = await processCardPayment({
          amount: checkout.totalAmount,
          cardToken: paymentData.cardToken!,
          reference: `CHECKOUT_${checkoutId}`,
        });
        break;

      case "BANK_TRANSFER":
        paymentResult = await processBankTransfer({
          amount: checkout.totalAmount,
          bankAccount: paymentData.bankAccount!,
          reference: `CHECKOUT_${checkoutId}`,
        });
        break;

      case "CASH":
        // For cash payments, mark as completed immediately
        paymentResult = {
          success: true,
          transactionId: `CASH_${checkoutId}_${Date.now()}`,
          reference: `CASH_${checkoutId}`,
        };
        break;

      default:
        throw new Error("Unsupported payment method");
    }

    console.log("====================================");
    console.log("Payment result", paymentResult);
    console.log("====================================");

    const products = checkout.cart.cartItems.map((item) => ({
      name: item.product.productName,
      quantity: item.quantity,
      price: item.product.unitPrice * item.quantity,
      unitPrice: item.product.unitPrice,
    }));

    if (paymentResult.success) {
      // Payment successful - update checkout
      const updatedCheckout = await updateCheckoutService(checkoutId, {
        paymentStatus: "PROCESSING",
        transactionId: paymentResult.transactionId,
        paymentReference: paymentResult.reference,
      });

      sendPaymentNotificationEmail({
        amount: checkout.totalAmount,
        phoneNumber: paymentData.phoneNumber!,
        restaurantName: checkout.restaurant.name,
        products,
        customer: {
          name: checkout.billingName || "Customer",
          email: checkout.billingEmail!,
        },
        checkoutId: checkoutId,
        paymentMethod: paymentData.paymentMethod,
      });
      if ("redirectUrl" in paymentResult) {
        return {
          success: true,
          checkout: updatedCheckout,
          transactionId: paymentResult.transactionId,
          redirectUrl: paymentResult.redirectUrl,
        };
      } else {
        return {
          success: true,
          checkout: updatedCheckout,
          transactionId: paymentResult.transactionId,
        };
      }
    } else {
      // Payment failed
      await updateCheckoutService(checkoutId, {
        paymentStatus: "FAILED",
      });

      return {
        success: false,
        error: "Payment failed",
      };
    }
  } catch (error: any) {
    console.log("====================================");
    console.log("Error processing payment", error);
    console.log("====================================");
    // Payment processing error
    await updateCheckoutService(checkoutId, {
      paymentStatus: "FAILED",
    });

    throw new Error(`Payment processing failed: ${error.message}`);
  }
};

// payment processing functions - Replace with actual payment gateway integrations

/**
 * function for PayPack mobile money integration
 * Replace with actual PayPack API integration
 */
async function processMobileMoneyPayment({
  amount,
  phoneNumber,
  reference,
}: {
  amount: number;
  phoneNumber: string;
  reference: string;
}) {
  try {
    // Clean and validate phone number
    const cleanedPhoneNumber = cleanPhoneNumber(phoneNumber);

    if (!isValidRwandaPhone(cleanedPhoneNumber)) {
      throw new Error(
        "Invalid Rwanda mobile number. Please use format: 078XXXXXXX, 079XXXXXXX, 072XXXXXXX, or 073XXXXXXX"
      );
    }

    console.log(
      `Processing mobile money payment: ${amount} RWF to ${cleanedPhoneNumber}`
    );

    // Process payment with retry logic
    let paymentResponse;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        // Make PayPack API call with timeout
        paymentResponse = await Promise.race([
          paypack.cashin({
            number: cleanedPhoneNumber,
            amount: Math.round(amount),
            environment:
              process.env.NODE_ENV === "development"
                ? "development"
                : "production",
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Payment timeout")), 25000)
          ),
        ]);

        console.log("====================================");
        console.log("PayPack payment response:", paymentResponse);
        console.log("====================================");

        break; // Success, exit retry loop
      } catch (error) {
        retryCount++;
        console.log(`Payment attempt ${retryCount} failed:`, error);

        if (retryCount >= maxRetries) {
          throw error;
        }

        // Wait before retry (exponential backoff)
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * Math.pow(2, retryCount))
        );
      }
    }

    // Check if payment was successful
    if (paymentResponse && paymentResponse.data) {
      return {
        success: true,
        transactionId: paymentResponse.data.ref || `PAYPACK_${Date.now()}`,
        reference: paymentResponse.data.ref || reference,
        status: paymentResponse.data.status.toUpperCase() || "PENDING",
      };
    } else {
      throw new Error("Invalid payment response from PayPack");
    }
  } catch (error: any) {
    console.log("PayPack payment failed:", error);

    // Determine error type for better user feedback
    let errorMessage = "Payment processing failed";

    if (error.message.includes("timeout")) {
      errorMessage = "Payment request timed out. Please try again.";
    } else if (
      error.message.includes("Invalid") ||
      error.message.includes("phone")
    ) {
      errorMessage = "Invalid phone number format";
    } else if (error.message.includes("insufficient")) {
      errorMessage = "Insufficient balance";
    }

    return {
      success: false,
      error: errorMessage,
      details: error.message,
    };
  }
}
/**
 * function for card payment processing
 */
async function processCardPayment({
  amount,
  cardToken,
  reference,
}: {
  amount: number;
  cardToken: string;
  reference: string;
}) {
  const url = await createOrder();

  await new Promise((resolve) => setTimeout(resolve, 1500));

  return {
    success: true,
    transactionId: `CARD_${Date.now()}`,
    reference,
    redirectUrl: url,
  };
}

/**
 * function for bank transfer processing
 */
async function processBankTransfer({
  amount,
  bankAccount,
  reference,
}: {
  amount: number;
  bankAccount: string;
  reference: string;
}) {
  console.log(`Processing bank transfer: ${amount} RWF to ${bankAccount}`);

  await new Promise((resolve) => setTimeout(resolve, 3000));

  return {
    success: true,
    transactionId: `BANK_${Date.now()}`,
    reference,
  };
}
