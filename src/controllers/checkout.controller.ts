import { Request, Response } from "express";
import {
  createCheckoutService,
  processPaymentService,
  verifyPaymentStatus,
} from "../services/checkout.services";
import { PaymentMethod } from "@prisma/client";
import {
  getOrderByIdService,
  updateOrderService,
} from "../services/order.services";
import { validateVoucherForCheckoutService } from "../services/voucher.service";
import prisma from "../prisma";
import { OTPService } from "../services/otp.service";

/**
 * Enhanced controller to create a new order from cart
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
      deviceFingerprint,
      narration,
      currency,
      voucherCode,
      fallbackPaymentMethod,
      cardDetails,
      bankDetails,
      otherServices,
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

    // Validate payment method specific fields
    if (paymentMethod === "MOBILE_MONEY" && !billingPhone) {
      return res.status(400).json({
        message: "Phone number is required for mobile money payments",
      });
    }

    // Validate voucher-specific requirements
    if (paymentMethod === "VOUCHER" && !voucherCode) {
      return res.status(400).json({
        message: "Voucher code is required for voucher payments",
      });
    }

    if (paymentMethod === "CARD") {
      if (!cardDetails) {
        return res.status(400).json({
          message: "Card details are required for card payments",
        });
      }

      const { cardNumber, cvv, expiryMonth, expiryYear } = cardDetails;
      if (!cardNumber || !cvv || !expiryMonth || !expiryYear) {
        return res.status(400).json({
          message:
            "Complete card details (number, CVV, expiry month/year) are required",
        });
      }
    }

    // For voucher payments, validate voucher first before sending OTP
    if (paymentMethod === "VOUCHER") {
      // Get cart total
      const cart = await prisma.cart.findUnique({
        where: { id: cartId },
        include: {
          cartItems: {
            include: {
              product: true,
            },
          },
        },
      });

      if (!cart) {
        return res.status(404).json({
          message: "Cart not found",
        });
      }

      const cartTotal = cart.cartItems.reduce(
        (total, item) => total + item.quantity * item.product.unitPrice,
        0
      );

      // Validate voucher
      const voucher = await prisma.voucher.findUnique({
        where: { voucherCode },
        include: {
          restaurant: true,
        },
      });

      if (!voucher) {
        return res.status(404).json({
          message: "Voucher not found",
        });
      }

      if (voucher.status !== "ACTIVE") {
        return res.status(400).json({
          message: "Voucher is not active",
        });
      }

      if (voucher.restaurantId !== restaurantId) {
        return res.status(403).json({
          message: "Voucher does not belong to this restaurant",
        });
      }

      // Check if voucher has sufficient credit based on discount percentage
      const discountAmount = (voucher.creditLimit * voucher.discountPercentage) / 100;
      
      if (cartTotal > discountAmount) {
        return res.status(400).json({
          message: `Insufficient voucher credit. Available: ${discountAmount} RWF`,
        });
      }

      console.log("discountAmount ", discountAmount);
      console.log("cartTotal ", cartTotal);

      const otpResult = await OTPService.sendOTPToRestaurant(restaurantId);

      if (!otpResult.success) {
        return res.status(400).json({
          message: otpResult.message,
        });
      }

      // Store checkout data temporarily for OTP verification
      const checkoutData = {
        cartId,
        restaurantId,
        paymentMethod,
        billingName,
        billingEmail,
        billingPhone,
        billingAddress,
        notes,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
        clientIp: req.ip,
        deviceFingerprint,
        narration,
        currency,
        voucherCode,
        fallbackPaymentMethod,
        cardDetails,
        bankDetails,
        otherServices,
      };

      return res.status(200).json({
        message:
          "OTP sent to your registered phone number. Please verify to complete voucher payment.",
        requiresOTP: true,
        checkoutSessionId: Buffer.from(JSON.stringify(checkoutData)).toString(
          "base64"
        ),
      });
    }

    // For non-voucher payments, process normally
    const paymentResult = await createCheckoutService({
      cartId,
      restaurantId,
      paymentMethod,
      billingName,
      billingEmail,
      billingPhone,
      billingAddress,
      notes,
      deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
      clientIp: req.ip,
      deviceFingerprint,
      narration,
      currency,
      voucherCode,
      fallbackPaymentMethod,
      cardDetails,
      bankDetails,
      otherServices,
    });

    if (paymentResult.success) {
      if (paymentResult.redirectUrl) {
        // For payments requiring redirect
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
        // For bank transfers
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
        // For other completed payments
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

export const verifyVoucherOTPAndCreateOrder = async (
  req: Request,
  res: Response
) => {
  try {
    const { otp, checkoutSessionId } = req.body;
    const restaurantId = (req as any).user.id;

    console.log("checkoutSessionId, otp ", checkoutSessionId, otp);

    if (!otp || !checkoutSessionId) {
      return res.status(400).json({
        message: "OTP and checkout session ID are required",
      });
    }

    // Get restaurant phone for OTP verification
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { phone: true },
    });

    if (!restaurant?.phone) {
      return res.status(400).json({
        message: "Restaurant phone number not found",
      });
    }

    // Verify OTP

    const otpResult = await OTPService.verifyOTP(
      restaurant.phone,
      otp,
      "VOUCHER_CHECKOUT"
    );

    console.log("otpResult ", otpResult);

    if (!otpResult.success) {
      return res.status(400).json({
        message: otpResult.message,
      });
    }

    // Decode checkout data
    let checkoutData;
    try {
      checkoutData = JSON.parse(
        Buffer.from(checkoutSessionId, "base64").toString()
      );
    } catch (error) {
      return res.status(400).json({
        message: "Invalid checkout session",
      });
    }

    console.log("checkoutData ", checkoutData);

    // Process voucher payment
    const paymentResult = await createCheckoutService(checkoutData);

    console.log("paymentResult ", paymentResult);

    if (paymentResult.success) {
      // Handle voucher payment response
      if ("voucherDetails" in paymentResult) {
        const voucherInfo = paymentResult.voucherDetails;

        if (voucherInfo && paymentResult.requiresAdditionalPayment) {
          res.status(200).json({
            message: paymentResult.message,
            data: {
              checkout: paymentResult.checkout,
              transactionId: paymentResult.transactionId,
              status: paymentResult.status,
              voucherApplied: true,
              voucherDetails: voucherInfo,
              requiresAdditionalPayment: true,
              additionalPaymentAmount: paymentResult.additionalPaymentAmount,
              redirectUrl: paymentResult.redirectUrl,
            },
          });
        } else if (voucherInfo) {
          res.status(200).json({
            message: paymentResult.message,
            data: {
              checkout: paymentResult.checkout,
              transactionId: paymentResult.transactionId,
              status: paymentResult.status,
              voucherApplied: true,
              voucherDetails: voucherInfo,
              creditRemaining: voucherInfo.remainingCredit,
              paymentDeadline:
                voucherInfo.remainingCredit > 0
                  ? new Date(
                      Date.now() + 30 * 24 * 60 * 60 * 1000
                    ).toISOString()
                  : null,
            },
          });
        }
      }
    } else {
      res.status(400).json({
        message: paymentResult.error || "Voucher payment failed",
        error: paymentResult.error,
      });
    }
  } catch (error: any) {
    res.status(500).json({
      message:
        error.message || "Failed to verify OTP and process voucher payment",
      error: error.message,
    });
  }
};

/**
 * Enhanced controller to process payment for order
 * POST /checkouts/:orderId/payment
 */
export const processPayment = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const {
      paymentMethod,
      phoneNumber,
      cardDetails,
      bankDetails,
      voucherCode,
      fallbackPaymentMethod,
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

    const paymentResult = await processPaymentService(orderId, {
      paymentMethod,
      phoneNumber,
      cardDetails,
      bankDetails,
      voucherCode,
      fallbackPaymentMethod,
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
 * Controller to verify payment status
 * GET /checkouts/:orderId/verify-payment
 */
export const verifyPayment = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { transactionId } = req.query;

    if (!transactionId) {
      return res.status(400).json({
        message: "Transaction ID is required for verification",
      });
    }

    // Get order details
    const order = await getOrderByIdService(orderId);

    // Verify payment
    const verificationResult = await verifyPaymentStatus(
      transactionId as string
    );

    if (verificationResult.success) {
      // Update order with verified payment details
      await updateOrderService(orderId, {
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
 * POST /checkouts/validate-voucher
 */
export const validateVoucherForCheckout = async (
  req: Request,
  res: Response
) => {
  try {
    const { voucherCode, orderAmount } = req.body;
    const restaurantId = (req as any).user.id;

    if (!voucherCode || !orderAmount) {
      return res.status(400).json({
        message: "Voucher code and order amount are required",
      });
    }

    const validation = await validateVoucherForCheckoutService(
      voucherCode,
      restaurantId,
      parseFloat(orderAmount)
    );

    if (!validation.valid) {
      return res.status(400).json({
        message: validation.error,
        valid: false,
      });
    }

    res.status(200).json({
      message: "Voucher validated successfully",
      valid: true,
      data: validation,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to validate voucher",
    });
  }
};
