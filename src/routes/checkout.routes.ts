import { Router } from "express";
import {
  createCheckout,
  processPayment,
  verifyPayment,
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

export default checkoutRoutes;
