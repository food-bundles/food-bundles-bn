import { Router } from "express";
import {
  addToCart,
  getMyCart,
  getCartById,
  updateCartItem,
  removeCartItem,
  clearCart,
  getAllCarts,
  getCartSummary,
} from "../controllers/cart.controller";
import { isAuthenticated, checkPermission } from "../middleware/authMiddleware";

const cartRoutes = Router();

// ========================================
// RESTAURANT CART ROUTES
// ========================================

/**
 * Add item to cart
 * POST /carts/add
 * Access: Restaurant only
 */
cartRoutes.post(
  "/add",
  isAuthenticated,
  checkPermission("RESTAURANT"),
  addToCart
);

/**
 * Get current restaurant's cart
 * GET /carts/my-cart
 * Access: Restaurant only
 */
cartRoutes.get(
  "/my-cart",
  isAuthenticated,
  checkPermission("RESTAURANT"),
  getMyCart
);

/**
 * Get cart summary (item count and total amount)
 * GET /carts/summary
 * Access: Restaurant only
 */
cartRoutes.get(
  "/summary",
  isAuthenticated,
  checkPermission("RESTAURANT"),
  getCartSummary
);

/**
 * Update cart item quantity
 * PATCH /carts/items/:cartItemId
 * Access: Restaurant only
 */
cartRoutes.patch(
  "/items/:cartItemId",
  isAuthenticated,
  checkPermission("RESTAURANT"),
  updateCartItem
);

/**
 * Remove item from cart
 * DELETE /carts/items/:cartItemId
 * Access: Restaurant only
 */
cartRoutes.delete(
  "/items/:cartItemId",
  isAuthenticated,
  checkPermission("RESTAURANT"),
  removeCartItem
);

/**
 * Clear entire cart
 * DELETE /carts/clear
 * Access: Restaurant only
 */
cartRoutes.delete(
  "/clear",
  isAuthenticated,
  checkPermission("RESTAURANT"),
  clearCart
);

// ========================================
// ADMIN CART ROUTES
// ========================================

/**
 * Get all carts (with filtering and pagination)
 * GET /carts
 * Access: Admin only
 */
cartRoutes.get("/", isAuthenticated, checkPermission("ADMIN"), getAllCarts);

/**
 * Get cart by ID
 * GET /carts/:cartId
 * Access: Admin only
 */
cartRoutes.get(
  "/:cartId",
  isAuthenticated,
  checkPermission("ADMIN"),
  getCartById
);

export default cartRoutes;
