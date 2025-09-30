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
} from "../controllers/order.controller";
import { isAuthenticated, checkPermission } from "../middleware/authMiddleware";

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
  checkPermission("RESTAURANT"),
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
orderRoutes.get("/", isAuthenticated, checkPermission("ADMIN"), getAllOrders);

/**
 * Delete order permanently (cancelled orders only)
 * DELETE /orders/:orderId
 * Access: Admin only
 */
orderRoutes.delete(
  "/:orderId",
  isAuthenticated,
  checkPermission("ADMIN"),
  deleteOrder
);

export default orderRoutes;
