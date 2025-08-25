"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelCheckout = exports.processPayment = exports.updateCheckout = exports.getAllCheckouts = exports.getMyCheckouts = exports.getCheckoutById = exports.createCheckout = void 0;
const checkout_services_1 = require("../services/checkout.services");
const client_1 = require("@prisma/client");
/**
 * Controller to create a new checkout from cart
 * POST /checkouts
 */
const createCheckout = async (req, res) => {
    try {
        const { cartId, paymentMethod, billingName, billingEmail, billingPhone, billingAddress, notes, deliveryDate, } = req.body;
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
        const checkout = await (0, checkout_services_1.createCheckoutService)({
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
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to create checkout",
        });
    }
};
exports.createCheckout = createCheckout;
/**
 * Controller to get checkout by ID
 * GET /checkouts/:checkoutId
 */
const getCheckoutById = async (req, res) => {
    try {
        const { checkoutId } = req.params;
        const userRole = req.user.role;
        const restaurantId = userRole === "RESTAURANT" ? req.user.id : undefined;
        const checkout = await (0, checkout_services_1.getCheckoutByIdService)(checkoutId, restaurantId);
        res.status(200).json({
            message: "Checkout retrieved successfully",
            data: checkout,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to get checkout",
        });
    }
};
exports.getCheckoutById = getCheckoutById;
/**
 * Controller to get all checkouts for authenticated restaurant
 * GET /checkouts/my-checkouts
 */
const getMyCheckouts = async (req, res) => {
    try {
        const restaurantId = req.user.id;
        const { page = 1, limit = 10, status, paymentMethod } = req.query;
        // Validate status if provided
        if (status &&
            !Object.values(client_1.PaymentStatus).includes(status)) {
            return res.status(400).json({
                message: "Invalid payment status",
            });
        }
        // Validate payment method if provided
        if (paymentMethod &&
            !Object.values(client_1.PaymentMethod).includes(paymentMethod)) {
            return res.status(400).json({
                message: "Invalid payment method",
            });
        }
        const result = await (0, checkout_services_1.getRestaurantCheckoutsService)(restaurantId, {
            page: parseInt(page),
            limit: parseInt(limit),
            status: status,
            paymentMethod: paymentMethod,
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
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to get checkouts",
        });
    }
};
exports.getMyCheckouts = getMyCheckouts;
/**
 * Controller to get all checkouts (Admin only)
 * GET /checkouts
 */
const getAllCheckouts = async (req, res) => {
    try {
        const { page = 1, limit = 10, status, paymentMethod } = req.query;
        // Validate status if provided
        if (status &&
            !Object.values(client_1.PaymentStatus).includes(status)) {
            return res.status(400).json({
                message: "Invalid payment status",
            });
        }
        // Validate payment method if provided
        if (paymentMethod &&
            !Object.values(client_1.PaymentMethod).includes(paymentMethod)) {
            return res.status(400).json({
                message: "Invalid payment method",
            });
        }
        const result = await (0, checkout_services_1.getAllCheckoutsService)({
            page: parseInt(page),
            limit: parseInt(limit),
            status: status,
            paymentMethod: paymentMethod,
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
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to get checkouts",
        });
    }
};
exports.getAllCheckouts = getAllCheckouts;
/**
 * Controller to update checkout
 * PATCH /checkouts/:checkoutId
 */
const updateCheckout = async (req, res) => {
    try {
        const { checkoutId } = req.params;
        const { paymentMethod, billingName, billingEmail, billingPhone, billingAddress, notes, deliveryDate, paymentStatus, paymentReference, transactionId, } = req.body;
        const userRole = req.user.role;
        const restaurantId = userRole === "RESTAURANT" ? req.user.id : undefined;
        // Validate payment method if provided
        if (paymentMethod &&
            !Object.values(client_1.PaymentMethod).includes(paymentMethod)) {
            return res.status(400).json({
                message: "Invalid payment method",
            });
        }
        // Validate payment status if provided
        if (paymentStatus &&
            !Object.values(client_1.PaymentStatus).includes(paymentStatus)) {
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
        const updateData = {};
        if (paymentMethod !== undefined)
            updateData.paymentMethod = paymentMethod;
        if (billingName !== undefined)
            updateData.billingName = billingName;
        if (billingEmail !== undefined)
            updateData.billingEmail = billingEmail;
        if (billingPhone !== undefined)
            updateData.billingPhone = billingPhone;
        if (billingAddress !== undefined)
            updateData.billingAddress = billingAddress;
        if (notes !== undefined)
            updateData.notes = notes;
        if (deliveryDate !== undefined)
            updateData.deliveryDate = new Date(deliveryDate);
        if (paymentStatus !== undefined)
            updateData.paymentStatus = paymentStatus;
        if (paymentReference !== undefined)
            updateData.paymentReference = paymentReference;
        if (transactionId !== undefined)
            updateData.transactionId = transactionId;
        const updatedCheckout = await (0, checkout_services_1.updateCheckoutService)(checkoutId, updateData, restaurantId);
        res.status(200).json({
            message: "Checkout updated successfully",
            data: updatedCheckout,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to update checkout",
        });
    }
};
exports.updateCheckout = updateCheckout;
/**
 * Controller to process payment for checkout
 * POST /checkouts/:checkoutId/payment
 */
const processPayment = async (req, res) => {
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
        const paymentResult = await (0, checkout_services_1.processPaymentService)(checkoutId, {
            paymentMethod,
            phoneNumber,
            cardToken,
            bankAccount,
        });
        if (paymentResult.success) {
            if (paymentMethod === "CARD" && paymentResult.redirectUrl) {
                // For card payments, redirect to PayPal
                return res.redirect(paymentResult.redirectUrl);
            }
            else {
                // For other payment methods, return JSON response
                res.status(200).json({
                    message: "Payment processed successfully",
                    data: {
                        checkout: paymentResult.checkout,
                        transactionId: paymentResult.transactionId,
                    },
                });
            }
        }
        else {
            res.status(400).json({
                message: paymentResult.error || "Payment failed",
            });
        }
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to process payment",
        });
    }
};
exports.processPayment = processPayment;
/**
 * Controller to cancel checkout
 * DELETE /checkouts/:checkoutId
 */
const cancelCheckout = async (req, res) => {
    try {
        const { checkoutId } = req.params;
        const userRole = req.user.role;
        const restaurantId = userRole === "RESTAURANT" ? req.user.id : undefined;
        const result = await (0, checkout_services_1.cancelCheckoutService)(checkoutId, restaurantId);
        res.status(200).json({
            message: result.message,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to cancel checkout",
        });
    }
};
exports.cancelCheckout = cancelCheckout;
