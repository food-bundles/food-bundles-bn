import { Router } from "express";
import {
  generateDeliveryOTP,
  resendDeliveryOTP,
  verifyDeliveryOTP,
  getLogisticsOrders,
  updateDeliveryStatus,
  getDeliveryDetails,
  getDeliveryOTPStatus,
} from "../controllers/delivery.controller";
import { isAuthenticated, checkPermission, allow } from "../middleware/authMiddleware";

const deliveryRoutes = Router();

// ========================================
// RESTAURANT ROUTES (OTP Management)
// ========================================

/**
 * Generate delivery OTP for an order
 * POST /deliveries/:orderId/otp/generate
 * Access: Restaurant (own orders)
 */
deliveryRoutes.post(
  "/:orderId/otp/generate",
  isAuthenticated,
  checkPermission("RESTAURANT"),
  generateDeliveryOTP
);

/**
 * Resend delivery OTP
 * POST /deliveries/:orderId/otp/resend
 * Access: Restaurant (own orders)
 */
deliveryRoutes.post(
  "/:orderId/otp/resend",
  isAuthenticated,
  checkPermission("RESTAURANT"),
  resendDeliveryOTP
);

/**
 * Get delivery OTP status
 * GET /deliveries/:orderId/otp/status
 * Access: Restaurant (own orders)
 */
deliveryRoutes.get(
  "/:orderId/otp/status",
  isAuthenticated,
  checkPermission("RESTAURANT"),
  getDeliveryOTPStatus
);

// ========================================
// LOGISTICS ROUTES (Order Management)
// ========================================

/**
 * Get orders available for logistics
 * GET /deliveries/orders
 * Access: Logistics only
 */
deliveryRoutes.get(
  "/orders",
  isAuthenticated,
  allow("deliveries"),
  getLogisticsOrders
);

/**
 * Verify delivery OTP and mark order as delivered
 * POST /deliveries/:orderId/otp/verify
 * Access: Logistics only
 */
deliveryRoutes.post(
  "/:orderId/otp/verify",
  isAuthenticated,
  allow.to("deliveries.confirm_delivery"),
  verifyDeliveryOTP
);

/**
 * Update delivery status
 * PATCH /deliveries/:orderId/status
 * Access: Logistics only
 */
deliveryRoutes.patch(
  "/:orderId/status",
  isAuthenticated,
  allow.to("deliveries.update_status"),
  updateDeliveryStatus
);

/**
 * Get delivery details
 * GET /deliveries/:orderId
 * Access: Logistics only
 */
deliveryRoutes.get(
  "/:orderId",
  isAuthenticated,
  allow("deliveries"),
  getDeliveryDetails
);

export default deliveryRoutes;