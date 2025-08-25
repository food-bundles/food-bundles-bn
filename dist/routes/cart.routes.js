"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cart_controller_1 = require("../controllers/cart.controller");
const authMiddleware_1 = require("../middleware/authMiddleware");
const cartRoutes = (0, express_1.Router)();
// ========================================
// RESTAURANT CART ROUTES
// ========================================
/**
 * Add item to cart
 * POST /carts/add
 * Access: Restaurant only
 */
cartRoutes.post("/add", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("RESTAURANT"), cart_controller_1.addToCart);
/**
 * Get current restaurant's cart
 * GET /carts/my-cart
 * Access: Restaurant only
 */
cartRoutes.get("/my-cart", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("RESTAURANT"), cart_controller_1.getMyCart);
/**
 * Get cart summary (item count and total amount)
 * GET /carts/summary
 * Access: Restaurant only
 */
cartRoutes.get("/summary", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("RESTAURANT"), cart_controller_1.getCartSummary);
/**
 * Update cart item quantity
 * PATCH /carts/items/:cartItemId
 * Access: Restaurant only
 */
cartRoutes.patch("/items/:cartItemId", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("RESTAURANT"), cart_controller_1.updateCartItem);
/**
 * Remove item from cart
 * DELETE /carts/items/:cartItemId
 * Access: Restaurant only
 */
cartRoutes.delete("/items/:cartItemId", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("RESTAURANT"), cart_controller_1.removeCartItem);
/**
 * Clear entire cart
 * DELETE /carts/clear
 * Access: Restaurant only
 */
cartRoutes.delete("/clear", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("RESTAURANT"), cart_controller_1.clearCart);
// ========================================
// ADMIN CART ROUTES
// ========================================
/**
 * Get all carts (with filtering and pagination)
 * GET /carts
 * Access: Admin only
 */
cartRoutes.get("/", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("ADMIN"), cart_controller_1.getAllCarts);
/**
 * Get cart by ID
 * GET /carts/:cartId
 * Access: Admin only
 */
cartRoutes.get("/:cartId", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("ADMIN"), cart_controller_1.getCartById);
exports.default = cartRoutes;
