"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const order_controller_1 = require("../controllers/order.controller");
const authMiddleware_1 = require("../middleware/authMiddleware");
const orderRoutes = (0, express_1.Router)();
// ========================================
// ORDER STATISTICS ROUTES (Must come before parameterized routes)
// ========================================
/**
 * Get order statistics
 * GET /orders/statistics
 * Access: Restaurant (own stats) or Admin (all stats)
 */
orderRoutes.get("/statistics", authMiddleware_1.isAuthenticated, order_controller_1.getOrderStatistics);
// ========================================
// RESTAURANT ORDER ROUTES
// ========================================
/**
 * Create order from completed checkout
 * POST /orders/from-checkout
 * Access: Restaurant only
 */
orderRoutes.post("/from-checkout", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("RESTAURANT"), order_controller_1.createOrderFromCheckout);
/**
 * Create direct order (without checkout process)
 * POST /orders/direct
 * Access: Restaurant (own orders) or Admin (any restaurant)
 */
orderRoutes.post("/direct", authMiddleware_1.isAuthenticated, order_controller_1.createDirectOrder);
/**
 * Get current restaurant's orders with filtering
 * GET /orders/my-orders
 * Access: Restaurant only
 */
orderRoutes.get("/my-orders", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("RESTAURANT"), order_controller_1.getMyOrders);
// ========================================
// ORDER LOOKUP ROUTES
// ========================================
/**
 * Get order by order number
 * GET /orders/number/:orderNumber
 * Access: Restaurant (own orders) or Admin (any order)
 */
orderRoutes.get("/number/:orderNumber", authMiddleware_1.isAuthenticated, order_controller_1.getOrderByNumber);
// ========================================
// ORDER MANAGEMENT ROUTES
// ========================================
/**
 * Cancel order and restore inventory
 * POST /orders/:orderId/cancel
 * Access: Restaurant (own orders) or Admin (any order)
 */
orderRoutes.post("/:orderId/cancel", authMiddleware_1.isAuthenticated, order_controller_1.cancelOrder);
/**
 * Update order details and status
 * PATCH /orders/:orderId
 * Access: Restaurant (own orders) or Admin (any order)
 */
orderRoutes.patch("/:orderId", authMiddleware_1.isAuthenticated, order_controller_1.updateOrder);
/**
 * Get order by ID with complete details
 * GET /orders/:orderId
 * Access: Restaurant (own orders) or Admin (any order)
 */
orderRoutes.get("/:orderId", authMiddleware_1.isAuthenticated, order_controller_1.getOrderById);
// ========================================
// ADMIN ONLY ROUTES
// ========================================
/**
 * Get all orders with filtering and pagination
 * GET /orders
 * Access: Admin only
 */
orderRoutes.get("/", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("ADMIN"), order_controller_1.getAllOrders);
/**
 * Delete order permanently (cancelled orders only)
 * DELETE /orders/:orderId
 * Access: Admin only
 */
orderRoutes.delete("/:orderId", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("ADMIN"), order_controller_1.deleteOrder);
exports.default = orderRoutes;
