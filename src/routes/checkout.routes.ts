import { Router } from "express";
import {
  createCheckout,
  processPayment,
  verifyPayment,
  verifyVoucherOTPAndCreateOrder,
} from "../controllers/checkout.controller";
import { isAuthenticated, checkPermission } from "../middleware/authMiddleware";

const checkoutRoutes = Router();

// ========================================
// RESTAURANT CHECKOUT ROUTES
// ========================================

/**
 * Create a new checkout from cart
 * POST /checkouts
 * Access: Restaurant only
 */
checkoutRoutes.post(
  "/",
  isAuthenticated,
  checkPermission("RESTAURANT"),
  createCheckout
);

/**
 * Process payment for checkout
 * POST /checkouts/:orderId/payment
 * Access: Restaurant (own checkouts) or Admin (any checkout)
 */
checkoutRoutes.post("/:orderId/payment", isAuthenticated, processPayment);

/**
 * Verify payment status
 * GET /checkouts/:orderId/verify-payment
 * Access: Restaurant (own checkouts) or Admin (any checkout)
 */
checkoutRoutes.get("/:orderId/verify-payment", isAuthenticated, verifyPayment);

/**
 * Verify OTP and create order for voucher payment
 * POST /checkouts/verify-voucher-otp
 * Access: Restaurant only
 */
checkoutRoutes.post(
  "/verify-voucher-otp",
  isAuthenticated,
  checkPermission("RESTAURANT"),
  verifyVoucherOTPAndCreateOrder
);

export default checkoutRoutes;
