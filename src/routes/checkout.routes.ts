import { Router } from "express";
import {
  createCheckout,
  processPayment,
  verifyPayment,
  getCheckoutStatus,
  verifyVoucherOTPAndCreateOrder,
  createAdminOrder,
  requestAdminOrderOTP,
  getAdminOrderLoanSessions,
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
  checkPermission("RESTAURANT", "AFFILIATOR", "HOTEL"),
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
 * Get payment status for tracking (polling)
 * GET /checkouts/:orderId/status
 * Access: Restaurant (own checkouts) or Admin (any checkout)
 */
checkoutRoutes.get("/:orderId/status", isAuthenticated, getCheckoutStatus);

/**
 * Verify OTP and create order for voucher payment
 * POST /checkouts/verify-voucher-otp
 * Access: Restaurant only
 */
checkoutRoutes.post(
  "/verify-voucher-otp",
  isAuthenticated,
  checkPermission("RESTAURANT", "AFFILIATOR", "HOTEL"),
  verifyVoucherOTPAndCreateOrder
);

/**
 * Usable loan sessions (vouchers) for a restaurant, for admin order payment
 * GET /checkouts/admin-order/loan-sessions/:restaurantId
 * Access: ADMIN or LOGISTICS only
 */
checkoutRoutes.get(
  "/admin-order/loan-sessions/:restaurantId",
  isAuthenticated,
  checkPermission("ADMIN", "LOGISTICS"),
  getAdminOrderLoanSessions
);

/**
 * Send OTP to restaurant before a voucher/prepaid admin order
 * POST /checkouts/admin-order/request-otp
 * Access: ADMIN or LOGISTICS only
 */
checkoutRoutes.post(
  "/admin-order/request-otp",
  isAuthenticated,
  checkPermission("ADMIN", "LOGISTICS"),
  requestAdminOrderOTP
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
