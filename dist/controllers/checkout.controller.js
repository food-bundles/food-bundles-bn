"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPayment = exports.processPayment = exports.createCheckout = void 0;
const checkout_services_1 = require("../services/checkout.services");
const client_1 = require("@prisma/client");
const order_services_1 = require("../services/order.services");
/**
 * Enhanced controller to create a new order from cart
 * POST /checkouts
 */
const createCheckout = async (req, res) => {
    try {
        const { cartId, paymentMethod, billingName, billingEmail, billingPhone, billingAddress, notes, deliveryDate, deviceFingerprint, narration, currency, cardDetails, bankDetails, } = req.body;
        const restaurantId = req.user.id;
        // Validate required fields
        if (!cartId || !paymentMethod) {
            return res.status(400).json({
                message: "Cart ID and payment method are required",
            });
        }
        // Validate payment method
        if (!Object.values(client_1.PaymentMethod).includes(paymentMethod)) {
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
        if (paymentMethod === "CARD") {
            if (!cardDetails) {
                return res.status(400).json({
                    message: "Card details are required for card payments",
                });
            }
            const { cardNumber, cvv, expiryMonth, expiryYear } = cardDetails;
            if (!cardNumber || !cvv || !expiryMonth || !expiryYear) {
                return res.status(400).json({
                    message: "Complete card details (number, CVV, expiry month/year) are required",
                });
            }
        }
        // Create checkout with payment details (payment is processed automatically in service)
        const paymentResult = await (0, checkout_services_1.createCheckoutService)({
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
            cardDetails,
            bankDetails,
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
            }
            else if (paymentResult.transferDetails) {
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
            }
            else {
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
        }
        else {
            res.status(400).json({
                message: paymentResult.error || "Payment failed",
                error: paymentResult.error,
            });
        }
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to create checkout",
            error: error.message,
        });
    }
};
exports.createCheckout = createCheckout;
/**
 * Enhanced controller to process payment for order
 * POST /checkouts/:orderId/payment
 */
const processPayment = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { paymentMethod, phoneNumber, cardDetails, bankDetails, processDirectly = true, } = req.body;
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
                    message: "Complete card details (number, CVV, expiry month/year) are required",
                });
            }
        }
        const paymentResult = await (0, checkout_services_1.processPaymentService)(orderId, {
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
            }
            else if (paymentResult.transferDetails) {
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
            }
            else {
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
        }
        else {
            res.status(400).json({
                message: paymentResult.error || "Payment failed",
                error: paymentResult.error,
            });
        }
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to process payment",
            error: error.message,
        });
    }
};
exports.processPayment = processPayment;
/**
 * New controller to verify payment status
 * GET /checkouts/:orderId/verify-payment
 */
const verifyPayment = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { transactionId } = req.query;
        if (!transactionId) {
            return res.status(400).json({
                message: "Transaction ID is required for verification",
            });
        }
        // Get order details
        const order = await (0, order_services_1.getOrderByIdService)(orderId);
        // Verify payment
        const verificationResult = await (0, checkout_services_1.verifyPaymentStatus)(transactionId);
        if (verificationResult.success) {
            // Update order with verified payment details
            await (0, order_services_1.updateOrderService)(orderId, {
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
        }
        else {
            res.status(400).json({
                message: "Payment verification failed",
                data: {
                    verified: false,
                    error: verificationResult.error,
                    status: verificationResult.status,
                },
            });
        }
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to verify payment",
            error: error.message,
        });
    }
};
exports.verifyPayment = verifyPayment;
