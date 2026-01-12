import { Request, Response } from "express";
import {
  createCheckoutService,
  processPaymentService,
  verifyPaymentStatus,
  createAdminOrderService,
} from "../services/checkout.services";
import { PaymentStatus } from "@prisma/client";
import {
  getOrderByIdService,
  updateOrderService,
} from "../services/order.services";
import {
  getVoucherByCodeService,
  validateVoucherForCheckoutService,
} from "../services/voucher.service";
import prisma from "../prisma";
import { OTPService } from "../services/otp.service";
import { getPaymentMethodByIdService } from "../services/payment-method.service";

/**
 * Enhanced controller to create a new order from cart
 * POST /checkouts
 */
export const createCheckout = async (req: Request, res: Response) => {
  try {
    const {
      cartId,
      paymentMethodId,
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
      promoCode,
      fallbackPaymentMethod,
      cardDetails,
      bankDetails,
      otherServices,
    } = req.body;

    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    // Determine if user is affiliator or restaurant
    let restaurantId = userId;
    let affiliatorId;

    if (userRole === "AFFILIATOR") {
      affiliatorId = userId;
      restaurantId = undefined;
    }

    // Validate required fields
    if (!cartId || !paymentMethodId) {
      return res.status(400).json({
        message: "Cart ID and payment method ID are required",
      });
    }

    // For Flutterwave payments (MOBILE_MONEY, CARD), no phone validation needed
    // Flutterwave handles all payment details through their hosted checkout

    // Validate voucher-specific requirements
    if (paymentMethodId) {
      // Get payment method to check if it's voucher
      try {
        const paymentMethodConfig = await getPaymentMethodByIdService(
          paymentMethodId
        );
        const paymentMethodName = paymentMethodConfig.name.toUpperCase();

        if (paymentMethodName === "VOUCHER" && !voucherCode) {
          return res.status(400).json({
            message: "Voucher code is required for voucher payments",
          });
        }

        // For voucher payments, validate voucher first before sending OTP
        if (paymentMethodName === "VOUCHER") {
          // Get cart to calculate total
          const cart = await prisma.cart.findUnique({
            where: { id: cartId },
            include: { cartItems: true },
          });

          if (!cart) {
            return res.status(404).json({ message: "Cart not found" });
          }

          const cartTotal = cart.cartItems.reduce(
            (sum, item) => sum + item.subtotal,
            0
          );

          // Validate voucher for checkout
          const voucherValidation = await validateVoucherForCheckoutService(
            voucherCode,
            cartTotal,
            restaurantId,
            affiliatorId
          );

          if (!voucherValidation.valid) {
            return res.status(400).json({
              message: voucherValidation.error,
            });
          }

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
            affiliatorId,
            paymentMethodId,
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
            promoCode,
            fallbackPaymentMethod,
            cardDetails,
            bankDetails,
            otherServices,
          };

          return res.status(200).json({
            message:
              "OTP sent to your registered phone number. Please verify to complete voucher payment.",
            requiresOTP: true,
            checkoutSessionId: Buffer.from(
              JSON.stringify(checkoutData)
            ).toString("base64"),
          });
        }
      } catch (error: any) {
        return res.status(400).json({
          message: "Invalid payment method ID",
        });
      }
    }

    // For non-voucher payments, process normally
    const paymentResult = await createCheckoutService({
      cartId,
      restaurantId,
      affiliatorId,
      paymentMethodId,
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
      promoCode,
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

    // For Flutterwave payments (MOBILE_MONEY, CARD), no validation needed
    // Flutterwave handles all payment details through their hosted checkout

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
        paymentStatus: PaymentStatus.COMPLETED,
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
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    // Determine if user is affiliator or restaurant
    let restaurantId = userId;
    let affiliatorId;

    if (userRole === "AFFILIATOR") {
      affiliatorId = userId;
      restaurantId = undefined;
    }

    if (!voucherCode || !orderAmount) {
      return res.status(400).json({
        message: "Voucher code and order amount are required",
      });
    }

    const validation = await validateVoucherForCheckoutService(
      voucherCode,
      parseFloat(orderAmount),
      restaurantId,
      affiliatorId
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

/**
 * Create order on behalf of restaurant by ADMIN/LOGISTICS
 * POST /checkouts/admin-order
 */
export const createAdminOrder = async (req: Request, res: Response) => {
  try {
    const {
      restaurantId,
      products,
      paymentMethod,
      voucherCode,
      promoCode,
      phoneNumber,
      notes,
      deliveryDate,
    } = req.body;
    const userRole = (req as any).user.role;

    // Check if user is ADMIN or LOGISTICS
    if (!["ADMIN", "LOGISTICS"].includes(userRole)) {
      return res.status(403).json({
        message:
          "Access denied. Only ADMIN or LOGISTICS can create orders on behalf of restaurants",
      });
    }

    // Validate required fields
    if (
      !restaurantId ||
      !products ||
      !Array.isArray(products) ||
      products.length === 0 ||
      !paymentMethod
    ) {
      return res.status(400).json({
        message:
          "Restaurant ID, products array, and payment method are required",
      });
    }

    // Validate products array structure
    for (const product of products) {
      if (!product.productId || !product.quantity || product.quantity <= 0) {
        return res.status(400).json({
          message: "Each product must have productId and quantity > 0",
        });
      }
    }

    // Validate voucher for voucher payments
    if (paymentMethod === "VOUCHER" && !voucherCode) {
      return res.status(400).json({
        message: "Voucher ID or voucher code is required for voucher payments",
      });
    }

    const paymentResult = await createAdminOrderService({
      restaurantId,
      products,
      paymentMethod,
      voucherCode,
      promoCode,
      phoneNumber,
      notes,
      deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
    });

    if (paymentResult.success) {
      if (paymentResult.redirectUrl) {
        res.status(201).json({
          message: "Order created - redirect required for payment",
          data: {
            checkout: paymentResult.checkout,
            transactionId: paymentResult.transactionId,
            redirectUrl: paymentResult.redirectUrl,
            status: paymentResult.status,
            requiresRedirect: true,
          },
        });
      } else if (paymentResult.transferDetails) {
        res.status(201).json({
          message: "Order created - bank transfer initiated",
          data: {
            checkout: paymentResult.checkout,
            transactionId: paymentResult.transactionId,
            transferDetails: paymentResult.transferDetails,
            status: paymentResult.status,
          },
        });
      } else {
        res.status(201).json({
          message:
            paymentResult.message ||
            "Order created and payment processed successfully",
          data: {
            checkout: paymentResult.checkout,
            transactionId: paymentResult.transactionId,
            status: paymentResult.status,
          },
        });
      }
    } else {
      res.status(400).json({
        message: paymentResult.error || "Order creation failed",
        error: paymentResult.error,
      });
    }
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to create admin order",
      error: error.message,
    });
  }
};
