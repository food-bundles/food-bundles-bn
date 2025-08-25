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
 * Get current restaurant's checkouts with filtering
 * GET /checkouts/my-checkouts
 * Access: Restaurant only
 */
checkoutRoutes.get("/my-checkouts", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("RESTAURANT"), checkout_controller_1.getMyCheckouts);
/**
 * Update checkout (before payment completion)
 * PATCH /checkouts/:checkoutId
 * Access: Restaurant (own checkouts) or Admin (any checkout)
 */
checkoutRoutes.patch("/:checkoutId", authMiddleware_1.isAuthenticated, checkout_controller_1.updateCheckout);
/**
 * Process payment for checkout
 * POST /checkouts/:checkoutId/payment
 * Access: Restaurant (own checkouts) or Admin (any checkout)
 */
checkoutRoutes.post("/:checkoutId/payment", authMiddleware_1.isAuthenticated, checkout_controller_1.processPayment);
/**
 * Cancel checkout (revert cart to active)
 * DELETE /checkouts/:checkoutId
 * Access: Restaurant (own checkouts) or Admin (any checkout)
 */
checkoutRoutes.delete("/:checkoutId", authMiddleware_1.isAuthenticated, checkout_controller_1.cancelCheckout);
// ========================================
// ADMIN CHECKOUT ROUTES
// ========================================
/**
 * Get all checkouts with filtering and pagination
 * GET /checkouts
 * Access: Admin only
 */
checkoutRoutes.get("/", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("ADMIN"), checkout_controller_1.getAllCheckouts);
/**
 * Get checkout by ID
 * GET /checkouts/:checkoutId
 * Access: Restaurant (own checkouts) or Admin (any checkout)
 */
checkoutRoutes.get("/:checkoutId", authMiddleware_1.isAuthenticated, checkout_controller_1.getCheckoutById);
exports.default = checkoutRoutes;
