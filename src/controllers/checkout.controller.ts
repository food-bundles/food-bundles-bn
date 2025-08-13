import { Request, Response } from "express";
import {
  createCheckoutService,
  getCheckoutByIdService,
  getRestaurantCheckoutsService,
  getAllCheckoutsService,
  updateCheckoutService,
  processPaymentService,
  cancelCheckoutService,
} from "../services/checkout.services";
import { PaymentMethod, PaymentStatus } from "@prisma/client";

/**
 * Controller to create a new checkout from cart
 * POST /checkouts
 */
export const createCheckout = async (req: Request, res: Response) => {
  try {
    const {
      cartId,
      paymentMethod,
      billingName,
      billingEmail,
      billingPhone,
      billingAddress,
      notes,
      deliveryDate,
    } = req.body;
    const restaurantId = (req as any).user.id;

    // Validate required fields
    if (!cartId || !paymentMethod) {
      return res.status(400).json({
        message: "Cart ID and payment method are required",
      });
    }

    // Validate payment method
    if (!Object.values(PaymentMethod).includes(paymentMethod)) {
      return res.status(400).json({
        message: "Invalid payment method",
      });
    }

    const checkout = await createCheckoutService({
      cartId,
      restaurantId,
      paymentMethod,
      billingName,
      billingEmail,
      billingPhone,
      billingAddress,
      notes,
      deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
    });

    res.status(201).json({
      message: "Checkout created successfully",
      data: checkout,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to create checkout",
    });
  }
};

/**
 * Controller to get checkout by ID
 * GET /checkouts/:checkoutId
 */
export const getCheckoutById = async (req: Request, res: Response) => {
  try {
    const { checkoutId } = req.params;
    const userRole = (req as any).user.role;
    const restaurantId =
      userRole === "RESTAURANT" ? (req as any).user.id : undefined;

    const checkout = await getCheckoutByIdService(checkoutId, restaurantId);

    res.status(200).json({
      message: "Checkout retrieved successfully",
      data: checkout,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get checkout",
    });
  }
};

/**
 * Controller to get all checkouts for authenticated restaurant
 * GET /checkouts/my-checkouts
 */
export const getMyCheckouts = async (req: Request, res: Response) => {
  try {
    const restaurantId = (req as any).user.id;
    const { page = 1, limit = 10, status, paymentMethod } = req.query;

    // Validate status if provided
    if (
      status &&
      !Object.values(PaymentStatus).includes(status as PaymentStatus)
    ) {
      return res.status(400).json({
        message: "Invalid payment status",
      });
    }

    // Validate payment method if provided
    if (
      paymentMethod &&
      !Object.values(PaymentMethod).includes(paymentMethod as PaymentMethod)
    ) {
      return res.status(400).json({
        message: "Invalid payment method",
      });
    }

    const result = await getRestaurantCheckoutsService(restaurantId, {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      status: status as PaymentStatus,
      paymentMethod: paymentMethod as PaymentMethod,
    });

    res.status(200).json({
      message: "Checkouts retrieved successfully",
      data: result.checkouts,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get checkouts",
    });
  }
};

/**
 * Controller to get all checkouts (Admin only)
 * GET /checkouts
 */
export const getAllCheckouts = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, status, paymentMethod } = req.query;

    // Validate status if provided
    if (
      status &&
      !Object.values(PaymentStatus).includes(status as PaymentStatus)
    ) {
      return res.status(400).json({
        message: "Invalid payment status",
      });
    }

    // Validate payment method if provided
    if (
      paymentMethod &&
      !Object.values(PaymentMethod).includes(paymentMethod as PaymentMethod)
    ) {
      return res.status(400).json({
        message: "Invalid payment method",
      });
    }

    const result = await getAllCheckoutsService({
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      status: status as PaymentStatus,
      paymentMethod: paymentMethod as PaymentMethod,
    });

    res.status(200).json({
      message: "Checkouts retrieved successfully",
      data: result.checkouts,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get checkouts",
    });
  }
};

/**
 * Controller to update checkout
 * PATCH /checkouts/:checkoutId
 */
export const updateCheckout = async (req: Request, res: Response) => {
  try {
    const { checkoutId } = req.params;
    const {
      paymentMethod,
      billingName,
      billingEmail,
      billingPhone,
      billingAddress,
      notes,
      deliveryDate,
      paymentStatus,
      paymentReference,
      transactionId,
    } = req.body;

    const userRole = (req as any).user.role;
    const restaurantId =
      userRole === "RESTAURANT" ? (req as any).user.id : undefined;

    // Validate payment method if provided
    if (
      paymentMethod &&
      !Object.values(PaymentMethod).includes(paymentMethod)
    ) {
      return res.status(400).json({
        message: "Invalid payment method",
      });
    }

    // Validate payment status if provided
    if (
      paymentStatus &&
      !Object.values(PaymentStatus).includes(paymentStatus)
    ) {
      return res.status(400).json({
        message: "Invalid payment status",
      });
    }

    // Only admins can update payment status
    if (paymentStatus && userRole !== "ADMIN") {
      return res.status(403).json({
        message: "Only admins can update payment status",
      });
    }

    const updateData: any = {};
    if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;
    if (billingName !== undefined) updateData.billingName = billingName;
    if (billingEmail !== undefined) updateData.billingEmail = billingEmail;
    if (billingPhone !== undefined) updateData.billingPhone = billingPhone;
    if (billingAddress !== undefined)
      updateData.billingAddress = billingAddress;
    if (notes !== undefined) updateData.notes = notes;
    if (deliveryDate !== undefined)
      updateData.deliveryDate = new Date(deliveryDate);
    if (paymentStatus !== undefined) updateData.paymentStatus = paymentStatus;
    if (paymentReference !== undefined)
      updateData.paymentReference = paymentReference;
    if (transactionId !== undefined) updateData.transactionId = transactionId;

    const updatedCheckout = await updateCheckoutService(
      checkoutId,
      updateData,
      restaurantId
    );

    res.status(200).json({
      message: "Checkout updated successfully",
      data: updatedCheckout,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to update checkout",
    });
  }
};

/**
 * Controller to process payment for checkout
 * POST /checkouts/:checkoutId/payment
 */
export const processPayment = async (req: Request, res: Response) => {
  try {
    const { checkoutId } = req.params;
    const { paymentMethod, phoneNumber, cardToken, bankAccount } = req.body;

    // Validate required fields
    if (!paymentMethod) {
      return res.status(400).json({
        message: "Payment method is required",
      });
    }

    // Validate payment method specific fields
    if (paymentMethod === "MOBILE_MONEY" && !phoneNumber) {
      return res.status(400).json({
        message: "Phone number is required for mobile money payments",
      });
    }

    if (paymentMethod === "CARD" && !cardToken) {
      return res.status(400).json({
        message: "Card token is required for card payments",
      });
    }

    if (paymentMethod === "BANK_TRANSFER" && !bankAccount) {
      return res.status(400).json({
        message: "Bank account is required for bank transfers",
      });
    }

    const paymentResult = await processPaymentService(checkoutId, {
      paymentMethod,
      phoneNumber,
      cardToken,
      bankAccount,
    });

    if (paymentResult.success) {
      if (paymentMethod === "CARD" && paymentResult.redirectUrl) {
        // For card payments, redirect to PayPal
        return res.redirect(paymentResult.redirectUrl as string);
      } else {
        // For other payment methods, return JSON response
        res.status(200).json({
          message: "Payment processed successfully",
          data: {
            checkout: paymentResult.checkout,
            transactionId: paymentResult.transactionId,
          },
        });
      }
    } else {
      res.status(400).json({
        message: paymentResult.error || "Payment failed",
      });
    }
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to process payment",
    });
  }
};

/**
 * Controller to cancel checkout
 * DELETE /checkouts/:checkoutId
 */
export const cancelCheckout = async (req: Request, res: Response) => {
  try {
    const { checkoutId } = req.params;
    const userRole = (req as any).user.role;
    const restaurantId =
      userRole === "RESTAURANT" ? (req as any).user.id : undefined;

    const result = await cancelCheckoutService(checkoutId, restaurantId);

    res.status(200).json({
      message: result.message,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to cancel checkout",
    });
  }
};
