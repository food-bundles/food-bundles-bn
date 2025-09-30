"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const checkout_controller_1 = require("../controllers/checkout.controller");
const authMiddleware_1 = require("../middleware/authMiddleware");
const checkoutRoutes = (0, express_1.Router)();
// ========================================
// RESTAURANT CHECKOUT ROUTES
// ========================================
/**
 * Create a new checkout from cart
 * POST /checkouts
 * Access: Restaurant only
 */
checkoutRoutes.post("/", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("RESTAURANT"), checkout_controller_1.createCheckout);
/**
 * Process payment for checkout
 * POST /checkouts/:orderId/payment
 * Access: Restaurant (own checkouts) or Admin (any checkout)
 */
checkoutRoutes.post("/:orderId/payment", authMiddleware_1.isAuthenticated, checkout_controller_1.processPayment);
/**
 * Verify payment status
 * GET /checkouts/:orderId/verify-payment
 * Access: Restaurant (own checkouts) or Admin (any checkout)
 */
checkoutRoutes.get("/:orderId/verify-payment", authMiddleware_1.isAuthenticated, checkout_controller_1.verifyPayment);
exports.default = checkoutRoutes;
