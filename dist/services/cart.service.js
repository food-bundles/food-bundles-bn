"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCartTotalService = exports.getAllCartsService = exports.clearCartService = exports.removeCartItemService = exports.updateCartItemService = exports.getCartByIdService = exports.getCartByRestaurantIdService = exports.addToCartService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
/**
 * Service to add item to cart or update existing item
 * If product already exists in cart, update the quantity
 */
const addToCartService = async (data) => {
    const { restaurantId, productId, quantity } = data;
    // Validate restaurant exists
    const restaurant = await prisma_1.default.restaurant.findUnique({
        where: { id: restaurantId },
    });
    if (!restaurant) {
        throw new Error("Restaurant not found");
    }
    // Validate product exists and is active
    const product = await prisma_1.default.product.findUnique({
        where: { id: productId },
    });
    if (!product) {
        throw new Error("Product not found");
    }
    if (product.status !== "ACTIVE") {
        throw new Error("Product is not available");
    }
    // Check if product has sufficient quantity
    if (product.quantity < quantity) {
        throw new Error(`Insufficient stock. Available: ${product.quantity}`);
    }
    // Find or create active cart for restaurant
    let cart = await prisma_1.default.cart.findFirst({
        where: {
            restaurantId,
            status: "ACTIVE",
        },
    });
    if (!cart) {
        // Create new cart if none exists
        cart = await prisma_1.default.cart.create({
            data: {
                restaurantId,
                status: "ACTIVE",
            },
        });
    }
    // Check if item already exists in cart
    const existingCartItem = await prisma_1.default.cartItem.findUnique({
        where: {
            cartId_productId: {
                cartId: cart.id,
                productId,
            },
        },
    });
    const subtotal = quantity * product.unitPrice;
    let cartItem;
    if (existingCartItem) {
        // Update existing cart item
        const newQuantity = existingCartItem.quantity + quantity;
        // Check total quantity doesn't exceed available stock
        if (product.quantity < newQuantity) {
            throw new Error(`Insufficient stock for total quantity. Available: ${product.quantity}`);
        }
        cartItem = await prisma_1.default.cartItem.update({
            where: { id: existingCartItem.id },
            data: {
                quantity: newQuantity,
                subtotal: newQuantity * product.unitPrice,
            },
            include: {
                product: {
                    select: {
                        id: true,
                        productName: true,
                        unitPrice: true,
                        images: true,
                        unit: true,
                    },
                },
            },
        });
    }
    else {
        // Create new cart item
        cartItem = await prisma_1.default.cartItem.create({
            data: {
                cartId: cart.id,
                productId,
                quantity,
                unitPrice: product.unitPrice,
                subtotal,
            },
            include: {
                product: {
                    select: {
                        id: true,
                        productName: true,
                        unitPrice: true,
                        images: true,
                        unit: true,
                    },
                },
            },
        });
    }
    // Update cart total amount
    await (0, exports.updateCartTotalService)(cart.id);
    const totalItems = await prisma_1.default.cartItem.count({
        where: { cartId: cart.id },
    });
    const cartItemWithTotalItems = {
        ...cartItem,
        totalItems,
    };
    return cartItemWithTotalItems;
};
exports.addToCartService = addToCartService;
/**
 * Service to get cart by restaurant ID
 */
const getCartByRestaurantIdService = async (restaurantId) => {
    // Validate restaurant exists
    const restaurant = await prisma_1.default.restaurant.findUnique({
        where: { id: restaurantId },
    });
    if (!restaurant) {
        throw new Error("Restaurant not found");
    }
    // Get active cart with items
    const cart = await prisma_1.default.cart.findFirst({
        where: {
            restaurantId,
            status: "ACTIVE",
        },
        include: {
            cartItems: {
                include: {
                    product: {
                        select: {
                            id: true,
                            productName: true,
                            unitPrice: true,
                            images: true,
                            unit: true,
                            category: true,
                            status: true,
                            quantity: true, // Available stock
                        },
                    },
                },
                orderBy: {
                    createdAt: "desc",
                },
            },
            restaurant: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
        },
    });
    if (!cart) {
        return null;
    }
    const totalItems = cart.cartItems.length;
    const totalQuantity = cart.cartItems.reduce((total, item) => total + item.quantity, 0);
    const cartWithStats = {
        totalItems,
        totalQuantity,
        ...cart,
    };
    return cartWithStats;
};
exports.getCartByRestaurantIdService = getCartByRestaurantIdService;
/**
 * Service to get cart by cart ID
 */
const getCartByIdService = async (cartId) => {
    const cart = await prisma_1.default.cart.findUnique({
        where: { id: cartId },
        include: {
            cartItems: {
                include: {
                    product: {
                        select: {
                            id: true,
                            productName: true,
                            unitPrice: true,
                            images: true,
                            unit: true,
                            category: true,
                            status: true,
                            quantity: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: "desc",
                },
            },
            restaurant: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
        },
    });
    if (!cart) {
        throw new Error("Cart not found");
    }
    return cart;
};
exports.getCartByIdService = getCartByIdService;
/**
 * Service to update cart item quantity
 */
const updateCartItemService = async (cartItemId, data, restaurantId) => {
    const { quantity } = data;
    if (quantity <= 0) {
        throw new Error("Quantity must be greater than 0");
    }
    // Find cart item and verify ownership
    const cartItem = await prisma_1.default.cartItem.findUnique({
        where: { id: cartItemId },
        include: {
            cart: true,
            product: true,
        },
    });
    if (!cartItem) {
        throw new Error("Cart item not found");
    }
    if (cartItem.cart.restaurantId !== restaurantId) {
        throw new Error("Unauthorized: Cart item does not belong to this restaurant");
    }
    // Check product availability
    if (cartItem.product.quantity < quantity) {
        throw new Error(`Insufficient stock. Available: ${cartItem.product.quantity}`);
    }
    // Update cart item
    const updatedCartItem = await prisma_1.default.cartItem.update({
        where: { id: cartItemId },
        data: {
            quantity,
            subtotal: quantity * cartItem.unitPrice,
        },
        include: {
            product: {
                select: {
                    id: true,
                    productName: true,
                    unitPrice: true,
                    images: true,
                    unit: true,
                },
            },
        },
    });
    // Update cart total
    await (0, exports.updateCartTotalService)(cartItem.cartId);
    return updatedCartItem;
};
exports.updateCartItemService = updateCartItemService;
/**
 * Service to remove item from cart
 */
const removeCartItemService = async (cartItemId, restaurantId) => {
    // Find cart item and verify ownership
    const cartItem = await prisma_1.default.cartItem.findUnique({
        where: { id: cartItemId },
        include: {
            cart: {
                include: {
                    cartItems: true,
                },
            },
        },
    });
    if (!cartItem) {
        throw new Error("Cart item not found");
    }
    if (cartItem.cart.restaurantId !== restaurantId) {
        throw new Error("Unauthorized: Cart item does not belong to this restaurant");
    }
    // Delete cart item
    await prisma_1.default.cartItem.delete({
        where: { id: cartItemId },
    });
    // Update cart total
    await (0, exports.updateCartTotalService)(cartItem.cartId);
    return { message: "Item removed from cart successfully" };
};
exports.removeCartItemService = removeCartItemService;
/**
 * Service to clear entire cart
 */
const clearCartService = async (restaurantId) => {
    // Find active cart
    const cart = await prisma_1.default.cart.findFirst({
        where: {
            restaurantId,
            status: "ACTIVE",
        },
    });
    if (!cart) {
        throw new Error("No active cart found");
    }
    // Delete all cart items
    await prisma_1.default.cartItem.deleteMany({
        where: { cartId: cart.id },
    });
    // Update cart total to 0
    await prisma_1.default.cart.update({
        where: { id: cart.id },
        data: { totalAmount: 0 },
    });
    return { message: "Cart cleared successfully" };
};
exports.clearCartService = clearCartService;
/**
 * Service to get all carts (Admin only)
 */
const getAllCartsService = async ({ page = 1, limit = 10, status, }) => {
    const skip = (page - 1) * limit;
    const where = {};
    if (status) {
        where.status = status;
    }
    const [carts, total] = await Promise.all([
        prisma_1.default.cart.findMany({
            where,
            skip,
            take: limit,
            include: {
                restaurant: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                cartItems: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                productName: true,
                                unitPrice: true,
                            },
                        },
                    },
                },
                _count: {
                    select: {
                        cartItems: true,
                    },
                },
            },
            orderBy: {
                updatedAt: "desc",
            },
        }),
        prisma_1.default.cart.count({ where }),
    ]);
    return {
        carts,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
};
exports.getAllCartsService = getAllCartsService;
/**
 * Helper service to update cart total amount
 */
const updateCartTotalService = async (cartId) => {
    // Calculate total from all cart items
    const cartItemsTotal = await prisma_1.default.cartItem.aggregate({
        where: { cartId },
        _sum: {
            subtotal: true,
        },
    });
    const totalAmount = cartItemsTotal._sum.subtotal || 0;
    // Update cart total
    await prisma_1.default.cart.update({
        where: { id: cartId },
        data: { totalAmount },
    });
    return totalAmount;
};
exports.updateCartTotalService = updateCartTotalService;
