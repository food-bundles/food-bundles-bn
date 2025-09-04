import { Request, Response } from "express";
import {
  createCheckoutService,
  getCheckoutByIdService,
  getRestaurantCheckoutsService,
  getAllCheckoutsService,
  updateCheckoutService,
  processPaymentService,
  cancelCheckoutService,
  verifyPaymentStatus,
} from "../services/checkout.services";
import { PaymentMethod, PaymentStatus } from "@prisma/client";

/**
 * Enhanced controller to create a new checkout from cart
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
      clientIp,
      deviceFingerprint,
      narration,
      currency,
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
      clientIp: clientIp || req.ip,
      deviceFingerprint,
      narration,
      currency,
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
 * Enhanced controller to update checkout
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
      txRef,
      flwRef,
      txOrderId,
      currency,
      clientIp,
      deviceFingerprint,
      narration,
      transferReference,
      transferAccount,
      transferBank,
      accountExpiration,
      transferNote,
      transferAmount,
      network,
      voucher,
      paymentCode,
      redirectUrl,
      authorizationMode,
      authorizationUrl,
      flwStatus,
      flwMessage,
      chargedAmount,
      appFee,
      merchantFee,
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

    // Only admins can update certain fields
    if (userRole !== "ADMIN") {
      const adminOnlyFields = [
        "paymentStatus",
        "flwStatus",
        "flwMessage",
        "chargedAmount",
        "appFee",
        "merchantFee",
        "flwRef",
      ];
      const providedFields = Object.keys(req.body);
      const unauthorizedFields = providedFields.filter((field) =>
        adminOnlyFields.includes(field)
      );

      if (unauthorizedFields.length > 0) {
        return res.status(403).json({
          message: `Only admins can update these fields: ${unauthorizedFields.join(
            ", "
          )}`,
        });
      }
    }

    const updateData: any = {};

    // Basic fields
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

    if (txRef !== undefined) updateData.txRef = txRef;
    if (flwRef !== undefined) updateData.flwRef = flwRef;
    if (txOrderId !== undefined) updateData.txOrderId = txOrderId;
    if (currency !== undefined) updateData.currency = currency;
    if (clientIp !== undefined) updateData.clientIp = clientIp;
    if (deviceFingerprint !== undefined)
      updateData.deviceFingerprint = deviceFingerprint;
    if (narration !== undefined) updateData.narration = narration;
    if (transferReference !== undefined)
      updateData.transferReference = transferReference;
    if (transferAccount !== undefined)
      updateData.transferAccount = transferAccount;
    if (transferBank !== undefined) updateData.transferBank = transferBank;
    if (accountExpiration !== undefined)
      updateData.accountExpiration = new Date(accountExpiration);
    if (transferNote !== undefined) updateData.transferNote = transferNote;
    if (transferAmount !== undefined)
      updateData.transferAmount = transferAmount;
    if (network !== undefined) updateData.network = network;
    if (voucher !== undefined) updateData.voucher = voucher;
    if (paymentCode !== undefined) updateData.paymentCode = paymentCode;
    if (redirectUrl !== undefined) updateData.redirectUrl = redirectUrl;
    if (authorizationMode !== undefined)
      updateData.authorizationMode = authorizationMode;
    if (authorizationUrl !== undefined)
      updateData.authorizationUrl = authorizationUrl;
    if (flwStatus !== undefined) updateData.flwStatus = flwStatus;
    if (flwMessage !== undefined) updateData.flwMessage = flwMessage;
    if (chargedAmount !== undefined) updateData.chargedAmount = chargedAmount;
    if (appFee !== undefined) updateData.appFee = appFee;
    if (merchantFee !== undefined) updateData.merchantFee = merchantFee;

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
 * Enhanced controller to process payment for checkout
 * POST /checkouts/:checkoutId/payment
 */
export const processPayment = async (req: Request, res: Response) => {
  try {
    const { checkoutId } = req.params;
    const {
      paymentMethod,
      phoneNumber,
      cardDetails,
      bankDetails,
      processDirectly = true,
    } = req.body;

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

    if (paymentMethod === "CARD" && !cardDetails) {
      return res.status(400).json({
        message: "Card details are required for card payments",
      });
    }

    // Validate card details if provided
    if (cardDetails) {
      const { cardNumber, cvv, expiryMonth, expiryYear } = cardDetails;
      if (!cardNumber || !cvv || !expiryMonth || !expiryYear) {
        return res.status(400).json({
          message:
            "Complete card details (number, CVV, expiry month/year) are required",
        });
      }
    }

    const paymentResult = await processPaymentService(checkoutId, {
      paymentMethod,
      phoneNumber,
      cardDetails,
      bankDetails,
      processDirectly,
    });

    if (paymentResult.success) {
      // Handle different response types based on payment method
      if (paymentResult.redirectUrl) {
        // For payments requiring redirect (3DS, authorization pages)
        res.status(200).json({
          message: "Payment initiated - redirect required",
          data: {
            checkout: paymentResult.checkout,
            transactionId: paymentResult.transactionId,
            redirectUrl: paymentResult.redirectUrl,
            status: paymentResult.status,
            requiresRedirect: true,
          },
        });
      } else if (paymentResult.transferDetails) {
        // For bank transfers with account details
        res.status(200).json({
          message: "Bank transfer initiated",
          data: {
            checkout: paymentResult.checkout,
            transactionId: paymentResult.transactionId,
            transferDetails: paymentResult.transferDetails,
            status: paymentResult.status,
            message: "Please transfer funds to the provided account details",
          },
        });
      } else {
        // For completed payments or pending mobile money
        res.status(200).json({
          message: paymentResult.message || "Payment processed successfully",
          data: {
            checkout: paymentResult.checkout,
            transactionId: paymentResult.transactionId,
            status: paymentResult.status,
          },
        });
      }
    } else {
      res.status(400).json({
        message: paymentResult.error || "Payment failed",
        error: paymentResult.error,
      });
    }
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to process payment",
      error: error.message,
    });
  }
};

/**
 * New controller to verify payment status
 * GET /checkouts/:checkoutId/verify-payment
 */
export const verifyPayment = async (req: Request, res: Response) => {
  try {
    const { checkoutId } = req.params;
    const { transactionId } = req.query;

    if (!transactionId) {
      return res.status(400).json({
        message: "Transaction ID is required for verification",
      });
    }

    // Get checkout details
    const checkout = await getCheckoutByIdService(checkoutId);

    // Verify payment
    const verificationResult = await verifyPaymentStatus(
      transactionId as string
    );

    if (verificationResult.success) {
      // Update checkout with verified payment details
      await updateCheckoutService(checkoutId, {
        paymentStatus: "COMPLETED",
        flwStatus: verificationResult.status,
        chargedAmount: verificationResult.chargedAmount,
        appFee: verificationResult.appFee,
        merchantFee: verificationResult.merchantFee,
        processorResponse: verificationResult.processorResponse,
      });

      res.status(200).json({
        message: "Payment verified successfully",
        data: {
          verified: true,
          status: verificationResult.status,
          amount: verificationResult.amount,
          currency: verificationResult.currency,
          transactionId: transactionId,
          flwRef: verificationResult.flwRef,
          txRef: verificationResult.txRef,
        },
      });
    } else {
      res.status(400).json({
        message: "Payment verification failed",
        data: {
          verified: false,
          error: verificationResult.error,
          status: verificationResult.status,
        },
      });
    }
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to verify payment",
      error: error.message,
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
