import { Router } from "express";
import {
  createOrderFromCart,
  createDirectOrder,
  getOrderById,
  getAllOrders,
  getMyOrders,
  updateOrder,
  cancelOrder,
  deleteOrder,
  getOrderStatistics,
  getOrderByNumber,
  reOrderFromExistingOrder,
  testWebSocket,
  editOrder,
  sendPaymentLink,
  generatePaymentLink,
  getOrderByPaymentLink,
  payViaPaymentLink,
  generateEBMInvoice,
} from "../controllers/order.controller";
import { isAuthenticated, checkPermission, allow } from "../middleware/authMiddleware";
import { paymentLinkRateLimiter } from "../middleware/rateLimiters";

const orderRoutes = Router();

// ========================================
// ORDER STATISTICS ROUTES (Must come before parameterized routes)
// ========================================

/**
 * Get order statistics
 * GET /orders/statistics
 * Access: Restaurant (own stats) or Admin (all stats)
 */
orderRoutes.get("/statistics", isAuthenticated, getOrderStatistics);

/**
 * Test WebSocket functionality
 * POST /orders/test-websocket
 * Access: Admin only (for testing)
 */
orderRoutes.post(
  "/test-websocket",
  isAuthenticated,
  allow("orders"),
  testWebSocket
);

// ========================================
// RESTAURANT ORDER ROUTES
// ========================================

/**
 * Create order from cart
 * POST /orders/from-cart
 * Access: Restaurant only
 */
orderRoutes.post(
  "/from-cart",
  isAuthenticated,
  checkPermission("RESTAURANT"),
  createOrderFromCart
);

/**
 * Create direct order (without checkout process)
 * POST /orders/direct
 * Access: Restaurant (own orders) or Admin (any restaurant)
 */
orderRoutes.post("/direct", isAuthenticated, createDirectOrder);

/**
 * Get current restaurant's orders with filtering
 * GET /orders/my-orders
 * Access: Restaurant only
 */
orderRoutes.get(
  "/my-orders",
  isAuthenticated,
  allow("orders", "RESTAURANT", "AFFILIATOR", "HOTEL"),
  getMyOrders
);

// ========================================
// ORDER LOOKUP ROUTES
// ========================================

/**
 * Get order by order number
 * GET /orders/number/:orderNumber
 * Access: Restaurant (own orders) or Admin (any order)
 */
orderRoutes.get("/number/:orderNumber", isAuthenticated, getOrderByNumber);

// ========================================
// PUBLIC PAYMENT LINK ROUTES (must come before /:orderId)
// ========================================

/**
 * Fetch a public-safe order summary by payment link token
 * GET /orders/pay/:token
 * Access: Public (no authentication) — rate limited
 */
orderRoutes.get("/pay/:token", paymentLinkRateLimiter, getOrderByPaymentLink);

/**
 * Submit a payment via a public payment link
 * POST /orders/pay/:token
 * Access: Public (no authentication) — rate limited
 */
orderRoutes.post("/pay/:token", paymentLinkRateLimiter, payViaPaymentLink);

// ========================================
// ORDER MANAGEMENT ROUTES
// ========================================

/**
 * Cancel order and restore inventory
 * POST /orders/:orderId/cancel
 * Access: Restaurant (own orders) or Admin (any order)
 */
orderRoutes.post("/:orderId/cancel", isAuthenticated, cancelOrder);

/**
 * Update order details and status
 * PATCH /orders/:orderId
 * Access: Restaurant (own orders) or Admin (any order)
 */
orderRoutes.patch("/:orderId", isAuthenticated, updateOrder);

/**
 * Re-order from an existing order
 * POST /orders/:orderId/reorder
 * Access: Restaurant (own orders) or Admin (any order)
 */
orderRoutes.post(
  "/:orderId/reorder",
  isAuthenticated,
  reOrderFromExistingOrder
);

/**
 * Edit order items, quantities, and prices
 * PATCH /orders/:orderId/edit
 * Access: Restaurant (own orders), Affiliator (own orders), or Admin (any order)
 */
orderRoutes.patch(
  "/:orderId/edit",
  isAuthenticated,
  allow("orders", "RESTAURANT", "AFFILIATOR"),
  editOrder
);

/**
 * Send/retry payment link for an order
 * POST /orders/:orderId/send-payment-link
 * Access: Restaurant (own orders) or Admin (any order)
 */
orderRoutes.post(
  "/:orderId/send-payment-link",
  isAuthenticated,
  sendPaymentLink
);

/**
 * Generate (or regenerate) a shareable public payment link for an order
 * POST /orders/:orderId/payment-link
 * Access: Restaurant/Affiliator (own orders) or Admin (any order)
 */
orderRoutes.post(
  "/:orderId/payment-link",
  isAuthenticated,
  generatePaymentLink
);

/**
 * Generate EBM invoice for an order
 * POST /orders/:orderId/generate-ebm-invoice
 * Access: Admin only
 */
orderRoutes.post(
  "/:orderId/generate-ebm-invoice",
  isAuthenticated,
  checkPermission("ADMIN"),
  generateEBMInvoice
);

/**
 * Get order by ID with complete details
 * GET /orders/:orderId
 * Access: Restaurant (own orders) or Admin (any order)
 */
orderRoutes.get("/:orderId", isAuthenticated, getOrderById);

// ========================================
// ADMIN ONLY ROUTES
// ========================================

/**
 * Get all orders with filtering and pagination
 * GET /orders
 * Access: Admin only
 */
orderRoutes.get("/", isAuthenticated, allow("orders"), getAllOrders);

/**
 * Delete order permanently (cancelled orders only)
 * DELETE /orders/:orderId
 * Access: Admin only
 */
orderRoutes.delete(
  "/:orderId",
  isAuthenticated,
  allow("orders"),
  deleteOrder
);

export default orderRoutes;
