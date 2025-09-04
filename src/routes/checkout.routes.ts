import { Router } from "express";
import {
  createCheckout,
  getCheckoutById,
  getMyCheckouts,
  getAllCheckouts,
  updateCheckout,
  processPayment,
  cancelCheckout,
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
 * Get current restaurant's checkouts with filtering
 * GET /checkouts/my-checkouts
 * Access: Restaurant only
 */
checkoutRoutes.get(
  "/my-checkouts",
  isAuthenticated,
  checkPermission("RESTAURANT"),
  getMyCheckouts
);

/**
 * Update checkout (before payment completion)
 * PATCH /checkouts/:checkoutId
 * Access: Restaurant (own checkouts) or Admin (any checkout)
 */
checkoutRoutes.patch("/:checkoutId", isAuthenticated, updateCheckout);

/**
 * Process payment for checkout
 * POST /checkouts/:checkoutId/payment
 * Access: Restaurant (own checkouts) or Admin (any checkout)
 */
checkoutRoutes.post("/:checkoutId/payment", isAuthenticated, processPayment);

/**
 * Verify payment status
 * GET /checkouts/:checkoutId/verify-payment
 * Access: Restaurant (own checkouts) or Admin (any checkout)
 */
checkoutRoutes.get(
  "/:checkoutId/verify-payment",
  isAuthenticated,
  verifyPayment
);

/**
 * Cancel checkout (revert cart to active)
 * DELETE /checkouts/:checkoutId
 * Access: Restaurant (own checkouts) or Admin (any checkout)
 */
checkoutRoutes.delete("/:checkoutId", isAuthenticated, cancelCheckout);

// ========================================
// ADMIN CHECKOUT ROUTES
// ========================================

/**
 * Get all checkouts with filtering and pagination
 * GET /checkouts
 * Access: Admin only
 */
checkoutRoutes.get(
  "/",
  isAuthenticated,
  checkPermission("ADMIN"),
  getAllCheckouts
);

/**
 * Get checkout by ID
 * GET /checkouts/:checkoutId
 * Access: Restaurant (own checkouts) or Admin (any checkout)
 */
checkoutRoutes.get("/:checkoutId", isAuthenticated, getCheckoutById);

export default checkoutRoutes;
