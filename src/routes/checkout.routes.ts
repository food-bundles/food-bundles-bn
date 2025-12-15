import { Router } from "express";
import {
  createCheckout,
  processPayment,
  verifyPayment,
  verifyVoucherOTPAndCreateOrder,
  createAdminOrder,
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
  checkPermission("RESTAURANT", "AFFILIATOR"),
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
  checkPermission("RESTAURANT", "AFFILIATOR"),
  verifyVoucherOTPAndCreateOrder
);

/**
 * Create order on behalf of restaurant by ADMIN/LOGISTICS
 * POST /checkouts/admin-order
 * Access: ADMIN or LOGISTICS only
 */
checkoutRoutes.post(
  "/admin-order",
  isAuthenticated,
  checkPermission("ADMIN", "LOGISTICS"),
  createAdminOrder
);

export default checkoutRoutes;
