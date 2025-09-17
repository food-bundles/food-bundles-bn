"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrderStatisticsService = exports.deleteOrderService = exports.cancelOrderService = exports.updateOrderService = exports.getRestaurantOrdersService = exports.getAllOrdersService = exports.getOrderByIdService = exports.createDirectOrderService = exports.createOrderFromCheckoutService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
/**
 * Service to create order from a completed checkout
 * This is the primary way orders are created after payment
 */
const createOrderFromCheckoutService = async (data) => {
    const { checkoutId, restaurantId, notes, requestedDelivery } = data;
    // Get checkout and validate
    const checkout = await prisma_1.default.cHECKOUT.findUnique({
        where: { id: checkoutId },
        include: {
            cart: {
                include: {
                    cartItems: {
                        include: {
                            product: true,
                        },
                    },
                },
            },
            restaurant: true,
        },
    });
    if (!checkout) {
        throw new Error("Checkout not found");
    }
    if (checkout.restaurantId !== restaurantId) {
        throw new Error("Unauthorized: Checkout does not belong to this restaurant");
    }
    if (checkout.orderId) {
        throw new Error("Order already exists for this checkout");
    }
    // Generate unique order number
    const orderNumber = await generateOrderNumber();
    // Validate product availability and calculate total
    let totalAmount = 0;
    for (const item of checkout.cart.cartItems) {
        if (item.product.status !== "ACTIVE") {
            throw new Error(`Product ${item.product.productName} is no longer available`);
        }
        if (item.product.quantity < item.quantity) {
            throw new Error(`Insufficient stock for ${item.product.productName}. Available: ${item.product.quantity}, Required: ${item.quantity}`);
        }
        totalAmount += item.subtotal;
    }
    // Create order with transaction to ensure data consistency
    const order = await prisma_1.default.$transaction(async (tx) => {
        // Create order
        const newOrder = await tx.order.create({
            data: {
                orderNumber,
                restaurantId,
                totalAmount,
                status: "PENDING",
                paymentMethod: checkout.paymentMethod,
                paymentStatus: checkout.paymentStatus,
                paymentReference: checkout.paymentReference,
                notes: notes || checkout.notes,
                requestedDelivery: requestedDelivery || checkout.deliveryDate,
            },
        });
        // Create order items from cart items
        const orderItemsData = checkout.cart.cartItems.map((item) => ({
            orderId: newOrder.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
        }));
        await tx.orderItem.createMany({
            data: orderItemsData,
        });
        // Update product quantities (reduce stock)
        for (const item of checkout.cart.cartItems) {
            await tx.product.update({
                where: { id: item.productId },
                data: {
                    quantity: {
                        decrement: item.quantity,
                    },
                },
            });
        }
        // Link checkout to order
        await tx.cHECKOUT.update({
            where: { id: checkoutId },
            data: { orderId: newOrder.id },
        });
        return newOrder;
    });
    // Return complete order with relations
    return await (0, exports.getOrderByIdService)(order.id);
};
exports.createOrderFromCheckoutService = createOrderFromCheckoutService;
/**
 * Service to create direct order (without checkout process)
 * Useful for admin or phone orders
 */
const createDirectOrderService = async (data) => {
    const { restaurantId, items, paymentMethod, notes, requestedDelivery } = data;
    if (!items || items.length === 0) {
        throw new Error("Order must contain at least one item");
    }
    // Validate restaurant exists
    const restaurant = await prisma_1.default.restaurant.findUnique({
        where: { id: restaurantId },
    });
    if (!restaurant) {
        throw new Error("Restaurant not found");
    }
    // Validate products and calculate total
    let totalAmount = 0;
    const validatedItems = [];
    for (const item of items) {
        const product = await prisma_1.default.product.findUnique({
            where: { id: item.productId },
        });
        if (!product) {
            throw new Error(`Product with ID ${item.productId} not found`);
        }
        if (product.status !== "ACTIVE") {
            throw new Error(`Product ${product.productName} is not available`);
        }
        if (product.quantity < item.quantity) {
            throw new Error(`Insufficient stock for ${product.productName}. Available: ${product.quantity}, Required: ${item.quantity}`);
        }
        const subtotal = product.unitPrice * item.quantity;
        totalAmount += subtotal;
        validatedItems.push({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: product.unitPrice,
            product,
        });
    }
    // Generate order number
    const orderNumber = await generateOrderNumber();
    // Create order with transaction
    const order = await prisma_1.default.$transaction(async (tx) => {
        // Create order
        const newOrder = await tx.order.create({
            data: {
                orderNumber,
                restaurantId,
                totalAmount,
                status: "PENDING",
                paymentMethod: paymentMethod || "CASH",
                paymentStatus: "PENDING",
                notes,
                requestedDelivery,
            },
        });
        // Create order items
        const orderItemsData = validatedItems.map((item) => ({
            orderId: newOrder.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
        }));
        await tx.orderItem.createMany({
            data: orderItemsData,
        });
        // Update product quantities
        for (const item of validatedItems) {
            await tx.product.update({
                where: { id: item.productId },
                data: {
                    quantity: {
                        decrement: item.quantity,
                    },
                },
            });
        }
        return newOrder;
    });
    return await (0, exports.getOrderByIdService)(order.id);
};
exports.createDirectOrderService = createDirectOrderService;
/**
 * Service to get order by ID with complete details
 */
const getOrderByIdService = async (orderId, restaurantId) => {
    const order = await prisma_1.default.order.findUnique({
        where: { id: orderId },
        include: {
            restaurant: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                },
            },
            orderItems: {
                include: {
                    product: {
                        select: {
                            id: true,
                            productName: true,
                            unitPrice: true,
                            unit: true,
                            images: true,
                            category: true,
                            status: true,
                        },
                    },
                },
            },
            checkout: {
                select: {
                    id: true,
                    billingName: true,
                    billingEmail: true,
                    billingPhone: true,
                    billingAddress: true,
                },
            },
        },
    });
    if (!order) {
        throw new Error("Order not found");
    }
    // Check restaurant ownership if restaurantId provided
    if (restaurantId && order.restaurantId !== restaurantId) {
        throw new Error("Unauthorized: Order does not belong to this restaurant");
    }
    return order;
};
exports.getOrderByIdService = getOrderByIdService;
/**
 * Service to get all orders with filtering and pagination
 */
const getAllOrdersService = async ({ page = 1, limit = 10, status, paymentStatus, restaurantId, dateFrom, dateTo, }) => {
    const skip = (page - 1) * limit;
    const where = {};
    if (status)
        where.status = status;
    if (paymentStatus)
        where.paymentStatus = paymentStatus;
    if (restaurantId)
        where.restaurantId = restaurantId;
    if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom)
            where.createdAt.gte = dateFrom;
        if (dateTo)
            where.createdAt.lte = dateTo;
    }
    const [orders, total] = await Promise.all([
        prisma_1.default.order.findMany({
            where,
            skip,
            take: limit,
            include: {
                restaurant: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                    },
                },
                orderItems: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                productName: true,
                                unitPrice: true,
                                unit: true,
                                category: true,
                            },
                        },
                    },
                },
                _count: {
                    select: {
                        orderItems: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        }),
        prisma_1.default.order.count({ where }),
    ]);
    return {
        orders,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
};
exports.getAllOrdersService = getAllOrdersService;
/**
 * Service to get restaurant's orders
 */
const getRestaurantOrdersService = async (restaurantId, filters) => {
    return (0, exports.getAllOrdersService)({
        ...filters,
        restaurantId,
    });
};
exports.getRestaurantOrdersService = getRestaurantOrdersService;
/**
 * Service to update order
 */
const updateOrderService = async (orderId, data, restaurantId) => {
    // Get existing order to validate
    const existingOrder = await (0, exports.getOrderByIdService)(orderId, restaurantId);
    // Validate status transitions
    if (data.status) {
        validateStatusTransition(existingOrder.status, data.status);
    }
    // Set actual delivery date when status changes to DELIVERED
    const updateData = { ...data };
    if (data.status === "DELIVERED" && !existingOrder.actualDelivery) {
        updateData.actualDelivery = new Date();
    }
    // Update order
    const updatedOrder = await prisma_1.default.order.update({
        where: { id: orderId },
        data: {
            ...updateData,
            updatedAt: new Date(),
        },
    });
    // Return complete order details
    return await (0, exports.getOrderByIdService)(updatedOrder.id);
};
exports.updateOrderService = updateOrderService;
/**
 * Service to cancel order
 * Restores product quantities and updates status
 */
const cancelOrderService = async (orderId, restaurantId, reason) => {
    const order = await (0, exports.getOrderByIdService)(orderId, restaurantId);
    // Check if order can be cancelled
    if (["DELIVERED", "CANCELLED", "REFUNDED"].includes(order.status)) {
        throw new Error(`Cannot cancel order with status: ${order.status}`);
    }
    // Restore product quantities and cancel order
    await prisma_1.default.$transaction(async (tx) => {
        // Restore product quantities
        for (const item of order.orderItems) {
            await tx.product.update({
                where: { id: item.productId },
                data: {
                    quantity: {
                        increment: item.quantity,
                    },
                },
            });
        }
        // Update order status
        await tx.order.update({
            where: { id: orderId },
            data: {
                status: "CANCELLED",
                notes: reason
                    ? `${order.notes ? order.notes + " | " : ""}CANCELLED: ${reason}`
                    : order.notes,
                updatedAt: new Date(),
            },
        });
    });
    return { message: "Order cancelled successfully" };
};
exports.cancelOrderService = cancelOrderService;
/**
 * Service to delete order (Admin only)
 * Should be used carefully as it removes order history
 */
const deleteOrderService = async (orderId) => {
    const order = await (0, exports.getOrderByIdService)(orderId);
    // Only allow deletion of CANCELLED orders
    if (order.status !== "CANCELLED") {
        throw new Error("Only cancelled orders can be deleted");
    }
    // Delete order and related items
    await prisma_1.default.$transaction([
        prisma_1.default.orderItem.deleteMany({
            where: { orderId },
        }),
        prisma_1.default.order.delete({
            where: { id: orderId },
        }),
    ]);
    return { message: "Order deleted successfully" };
};
exports.deleteOrderService = deleteOrderService;
/**
 * Helper function to generate unique order number
 */
async function generateOrderNumber() {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    // Get today's order count
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));
    const todayOrderCount = await prisma_1.default.order.count({
        where: {
            createdAt: {
                gte: startOfDay,
                lte: endOfDay,
            },
        },
    });
    const orderSequence = (todayOrderCount + 1).toString().padStart(4, "0");
    return `ORD${year}${month}${day}${orderSequence}`;
}
/**
 * Helper function to validate order status transitions
 */
function validateStatusTransition(currentStatus, newStatus) {
    const validTransitions = {
        PENDING: ["CONFIRMED", "CANCELLED"],
        CONFIRMED: ["PREPARING", "CANCELLED"],
        PREPARING: ["READY", "CANCELLED"],
        READY: ["IN_TRANSIT", "DELIVERED", "CANCELLED"],
        IN_TRANSIT: ["DELIVERED", "CANCELLED"],
        DELIVERED: ["REFUNDED"], // Only admin can refund
        CANCELLED: [], // Cannot change from cancelled
        REFUNDED: [], // Cannot change from refunded
    };
    if (!validTransitions[currentStatus].includes(newStatus)) {
        throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
    }
}
/**
 * Service to get order statistics (Admin)
 */
const getOrderStatisticsService = async ({ restaurantId, dateFrom, dateTo, } = {}) => {
    const where = {};
    if (restaurantId)
        where.restaurantId = restaurantId;
    if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom)
            where.createdAt.gte = dateFrom;
        if (dateTo)
            where.createdAt.lte = dateTo;
    }
    const [totalOrders, pendingOrders, confirmedOrders, preparingOrders, readyOrders, inTransitOrders, deliveredOrders, cancelledOrders, totalRevenue, averageOrderValue,] = await Promise.all([
        prisma_1.default.order.count({ where }),
        prisma_1.default.order.count({ where: { ...where, status: "PENDING" } }),
        prisma_1.default.order.count({ where: { ...where, status: "CONFIRMED" } }),
        prisma_1.default.order.count({ where: { ...where, status: "PREPARING" } }),
        prisma_1.default.order.count({ where: { ...where, status: "READY" } }),
        prisma_1.default.order.count({ where: { ...where, status: "IN_TRANSIT" } }),
        prisma_1.default.order.count({ where: { ...where, status: "DELIVERED" } }),
        prisma_1.default.order.count({ where: { ...where, status: "CANCELLED" } }),
        prisma_1.default.order.aggregate({
            where: { ...where, status: "DELIVERED" },
            _sum: { totalAmount: true },
        }),
        prisma_1.default.order.aggregate({
            where: { ...where, status: "DELIVERED" },
            _avg: { totalAmount: true },
        }),
    ]);
    return {
        totalOrders,
        ordersByStatus: {
            pending: pendingOrders,
            confirmed: confirmedOrders,
            preparing: preparingOrders,
            ready: readyOrders,
            inTransit: inTransitOrders,
            delivered: deliveredOrders,
            cancelled: cancelledOrders,
        },
        revenue: {
            total: totalRevenue._sum.totalAmount || 0,
            average: averageOrderValue._avg.totalAmount || 0,
        },
    };
};
exports.getOrderStatisticsService = getOrderStatisticsService;
