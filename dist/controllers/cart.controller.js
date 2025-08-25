"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCartSummary = exports.getAllCarts = exports.clearCart = exports.removeCartItem = exports.updateCartItem = exports.getCartById = exports.getMyCart = exports.addToCart = void 0;
const cart_service_1 = require("../services/cart.service");
/**
 * Controller to add item to cart
 * POST /carts/add
 */
const addToCart = async (req, res) => {
    try {
        const { productId, quantity } = req.body;
        const restaurantId = req.user.id; // Assuming authenticated user
        // Validate required fields
        if (!productId || !quantity) {
            return res.status(400).json({
                message: "Product ID and quantity are required",
            });
        }
        if (quantity <= 0) {
            return res.status(400).json({
                message: "Quantity must be greater than 0",
            });
        }
        const cartItem = await (0, cart_service_1.addToCartService)({
            restaurantId,
            productId,
            quantity: Number(quantity),
        });
        res.status(200).json({
            message: "Item added to cart successfully",
            data: cartItem,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to add item to cart",
        });
    }
};
exports.addToCart = addToCart;
/**
 * Controller to get current cart for authenticated restaurant
 * GET /carts/my-cart
 */
const getMyCart = async (req, res) => {
    try {
        const restaurantId = req.user.id;
        const cart = await (0, cart_service_1.getCartByRestaurantIdService)(restaurantId);
        if (!cart) {
            return res.status(200).json({
                message: "Cart is empty",
                data: null,
            });
        }
        res.status(200).json({
            message: "Cart retrieved successfully",
            data: cart,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to get cart",
        });
    }
};
exports.getMyCart = getMyCart;
/**
 * Controller to get cart by ID (Admin only)
 * GET /carts/:cartId
 */
const getCartById = async (req, res) => {
    try {
        const { cartId } = req.params;
        const cart = await (0, cart_service_1.getCartByIdService)(cartId);
        res.status(200).json({
            message: "Cart retrieved successfully",
            data: cart,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to get cart",
        });
    }
};
exports.getCartById = getCartById;
/**
 * Controller to update cart item quantity
 * PATCH /carts/items/:cartItemId
 */
const updateCartItem = async (req, res) => {
    try {
        const { cartItemId } = req.params;
        const { quantity } = req.body;
        const restaurantId = req.user.id;
        // Validate required fields
        if (!quantity) {
            return res.status(400).json({
                message: "Quantity is required",
            });
        }
        if (quantity <= 0) {
            return res.status(400).json({
                message: "Quantity must be greater than 0",
            });
        }
        const updatedCartItem = await (0, cart_service_1.updateCartItemService)(cartItemId, { quantity: Number(quantity) }, restaurantId);
        res.status(200).json({
            message: "Cart item updated successfully",
            data: updatedCartItem,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to update cart item",
        });
    }
};
exports.updateCartItem = updateCartItem;
/**
 * Controller to remove item from cart
 * DELETE /carts/items/:cartItemId
 */
const removeCartItem = async (req, res) => {
    try {
        const { cartItemId } = req.params;
        const restaurantId = req.user.id;
        const result = await (0, cart_service_1.removeCartItemService)(cartItemId, restaurantId);
        res.status(200).json({
            message: result.message,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to remove cart item",
        });
    }
};
exports.removeCartItem = removeCartItem;
/**
 * Controller to clear entire cart
 * DELETE /carts/clear
 */
const clearCart = async (req, res) => {
    try {
        const restaurantId = req.user.id;
        const result = await (0, cart_service_1.clearCartService)(restaurantId);
        res.status(200).json({
            message: result.message,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to clear cart",
        });
    }
};
exports.clearCart = clearCart;
/**
 * Controller to get all carts (Admin only)
 * GET /carts
 */
const getAllCarts = async (req, res) => {
    try {
        const { page = 1, limit = 10, status } = req.query;
        const result = await (0, cart_service_1.getAllCartsService)({
            page: parseInt(page),
            limit: parseInt(limit),
            status: status,
        });
        res.status(200).json({
            message: "Carts retrieved successfully",
            data: result.carts,
            pagination: {
                page: result.page,
                limit: result.limit,
                total: result.total,
                totalPages: result.totalPages,
            },
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to get carts",
        });
    }
};
exports.getAllCarts = getAllCarts;
/**
 * Controller to get cart summary (item count and total)
 * GET /carts/summary
 */
const getCartSummary = async (req, res) => {
    try {
        const restaurantId = req.user.id;
        const cart = await (0, cart_service_1.getCartByRestaurantIdService)(restaurantId);
        if (!cart) {
            return res.status(200).json({
                message: "Cart summary retrieved successfully",
                data: {
                    itemCount: 0,
                    totalAmount: 0,
                },
            });
        }
        const itemCount = cart.cartItems.reduce((total, item) => total + item.quantity, 0);
        res.status(200).json({
            message: "Cart summary retrieved successfully",
            data: {
                itemCount,
                totalAmount: cart.totalAmount,
                cartId: cart.id,
            },
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to get cart summary",
        });
    }
};
exports.getCartSummary = getCartSummary;
