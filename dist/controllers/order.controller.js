"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrderByNumber = exports.getOrderStatistics = exports.deleteOrder = exports.cancelOrder = exports.updateOrder = exports.getMyOrders = exports.getAllOrders = exports.getOrderById = exports.createDirectOrder = exports.createOrderFromCheckout = void 0;
const order_services_1 = require("../services/order.services");
const client_1 = require("@prisma/client");
const prisma_1 = __importDefault(require("../prisma"));
/**
 * Controller to create order from checkout
 * POST /orders/from-checkout
 */
const createOrderFromCheckout = async (req, res) => {
    try {
        const { checkoutId, notes, requestedDelivery } = req.body;
        const restaurantId = req.user.id;
        // Validate required fields
        if (!checkoutId) {
            return res.status(400).json({
                message: "Checkout ID is required",
            });
        }
        const order = await (0, order_services_1.createOrderFromCheckoutService)({
            checkoutId,
            restaurantId,
            notes,
            requestedDelivery: requestedDelivery
                ? new Date(requestedDelivery)
                : undefined,
        });
        res.status(201).json({
            message: "Order created from checkout successfully",
            data: order,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to create order from checkout",
        });
    }
};
exports.createOrderFromCheckout = createOrderFromCheckout;
/**
 * Controller to create direct order
 * POST /orders/direct
 */
const createDirectOrder = async (req, res) => {
    try {
        const { items, paymentMethod, notes, requestedDelivery } = req.body;
        const userRole = req.user.role;
        const restaurantId = userRole === "RESTAURANT" ? req.user.id : req.body.restaurantId;
        // Validate required fields
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                message: "Items array is required and cannot be empty",
            });
        }
        // For non-restaurant users, restaurantId must be provided
        if (userRole !== "RESTAURANT" && !restaurantId) {
            return res.status(400).json({
                message: "Restaurant ID is required",
            });
        }
        // Validate items structure
        for (const item of items) {
            if (!item.productId || !item.quantity || item.quantity <= 0) {
                return res.status(400).json({
                    message: "Each item must have productId and quantity > 0",
                });
            }
        }
        // Validate payment method if provided
        if (paymentMethod &&
            !Object.values(client_1.PaymentMethod).includes(paymentMethod)) {
            return res.status(400).json({
                message: "Invalid payment method",
            });
        }
        const order = await (0, order_services_1.createDirectOrderService)({
            restaurantId,
            items,
            paymentMethod,
            notes,
            requestedDelivery: requestedDelivery
                ? new Date(requestedDelivery)
                : undefined,
        });
        res.status(201).json({
            message: "Order created successfully",
            data: order,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to create direct order",
        });
    }
};
exports.createDirectOrder = createDirectOrder;
/**
 * Controller to get order by ID
 * GET /orders/:orderId
 */
const getOrderById = async (req, res) => {
    try {
        const { orderId } = req.params;
        const userRole = req.user.role;
        const restaurantId = userRole === "RESTAURANT" ? req.user.id : undefined;
        const order = await (0, order_services_1.getOrderByIdService)(orderId, restaurantId);
        res.status(200).json({
            message: "Order retrieved successfully",
            data: order,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to get order",
        });
    }
};
exports.getOrderById = getOrderById;
/**
 * Controller to get all orders (Admin only)
 * GET /orders
 */
const getAllOrders = async (req, res) => {
    try {
        const { page = 1, limit = 10, status, paymentStatus, restaurantId, dateFrom, dateTo, } = req.query;
        // Validate status if provided
        if (status && !Object.values(client_1.OrderStatus).includes(status)) {
            return res.status(400).json({
                message: "Invalid order status",
            });
        }
        // Validate payment status if provided
        if (paymentStatus &&
            !Object.values(client_1.PaymentStatus).includes(paymentStatus)) {
            return res.status(400).json({
                message: "Invalid payment status",
            });
        }
        const result = await (0, order_services_1.getAllOrdersService)({
            page: parseInt(page),
            limit: parseInt(limit),
            status: status,
            paymentStatus: paymentStatus,
            restaurantId: restaurantId,
            dateFrom: dateFrom ? new Date(dateFrom) : undefined,
            dateTo: dateTo ? new Date(dateTo) : undefined,
        });
        res.status(200).json({
            message: "Orders retrieved successfully",
            data: result.orders,
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
            message: error.message || "Failed to get orders",
        });
    }
};
exports.getAllOrders = getAllOrders;
/**
 * Controller to get restaurant's orders
 * GET /orders/my-orders
 */
const getMyOrders = async (req, res) => {
    try {
        const restaurantId = req.user.id;
        const { page = 1, limit = 10, status, paymentStatus, dateFrom, dateTo, } = req.query;
        // Validate status if provided
        if (status && !Object.values(client_1.OrderStatus).includes(status)) {
            return res.status(400).json({
                message: "Invalid order status",
            });
        }
        // Validate payment status if provided
        if (paymentStatus &&
            !Object.values(client_1.PaymentStatus).includes(paymentStatus)) {
            return res.status(400).json({
                message: "Invalid payment status",
            });
        }
        const result = await (0, order_services_1.getRestaurantOrdersService)(restaurantId, {
            page: parseInt(page),
            limit: parseInt(limit),
            status: status,
            paymentStatus: paymentStatus,
            dateFrom: dateFrom ? new Date(dateFrom) : undefined,
            dateTo: dateTo ? new Date(dateTo) : undefined,
        });
        res.status(200).json({
            message: "Orders retrieved successfully",
            data: result.orders,
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
            message: error.message || "Failed to get orders",
        });
    }
};
exports.getMyOrders = getMyOrders;
/**
 * Controller to update order
 * PATCH /orders/:orderId
 */
const updateOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status, notes, requestedDelivery, estimatedDelivery, actualDelivery, paymentMethod, paymentStatus, paymentReference, } = req.body;
        const userRole = req.user.role;
        const restaurantId = userRole === "RESTAURANT" ? req.user.id : undefined;
        // Validate status if provided
        if (status && !Object.values(client_1.OrderStatus).includes(status)) {
            return res.status(400).json({
                message: "Invalid order status",
            });
        }
        // Validate payment status if provided
        if (paymentStatus &&
            !Object.values(client_1.PaymentStatus).includes(paymentStatus)) {
            return res.status(400).json({
                message: "Invalid payment status",
            });
        }
        // Validate payment method if provided
        if (paymentMethod &&
            !Object.values(client_1.PaymentMethod).includes(paymentMethod)) {
            return res.status(400).json({
                message: "Invalid payment method",
            });
        }
        // Only admins can update payment-related fields
        if ((paymentStatus || paymentReference) && userRole !== "ADMIN") {
            return res.status(403).json({
                message: "Only admins can update payment information",
            });
        }
        const updateData = {};
        if (status !== undefined)
            updateData.status = status;
        if (notes !== undefined)
            updateData.notes = notes;
        if (requestedDelivery !== undefined)
            updateData.requestedDelivery = new Date(requestedDelivery);
        if (estimatedDelivery !== undefined)
            updateData.estimatedDelivery = new Date(estimatedDelivery);
        if (actualDelivery !== undefined)
            updateData.actualDelivery = new Date(actualDelivery);
        if (paymentMethod !== undefined)
            updateData.paymentMethod = paymentMethod;
        if (paymentStatus !== undefined)
            updateData.paymentStatus = paymentStatus;
        if (paymentReference !== undefined)
            updateData.paymentReference = paymentReference;
        const updatedOrder = await (0, order_services_1.updateOrderService)(orderId, updateData, restaurantId);
        res.status(200).json({
            message: "Order updated successfully",
            data: updatedOrder,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to update order",
        });
    }
};
exports.updateOrder = updateOrder;
/**
 * Controller to cancel order
 * POST /orders/:orderId/cancel
 */
const cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { reason } = req.body;
        const userRole = req.user.role;
        const restaurantId = userRole === "RESTAURANT" ? req.user.id : undefined;
        const result = await (0, order_services_1.cancelOrderService)(orderId, restaurantId, reason);
        res.status(200).json({
            message: result.message,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to cancel order",
        });
    }
};
exports.cancelOrder = cancelOrder;
/**
 * Controller to delete order (Admin only)
 * DELETE /orders/:orderId
 */
const deleteOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const result = await (0, order_services_1.deleteOrderService)(orderId);
        res.status(200).json({
            message: result.message,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to delete order",
        });
    }
};
exports.deleteOrder = deleteOrder;
/**
 * Controller to get order statistics
 * GET /orders/statistics
 */
const getOrderStatistics = async (req, res) => {
    try {
        const { restaurantId, dateFrom, dateTo } = req.query;
        const userRole = req.user.role;
        // If user is restaurant, only show their statistics
        const targetRestaurantId = userRole === "RESTAURANT"
            ? req.user.id
            : restaurantId;
        const statistics = await (0, order_services_1.getOrderStatisticsService)({
            restaurantId: targetRestaurantId,
            dateFrom: dateFrom ? new Date(dateFrom) : undefined,
            dateTo: dateTo ? new Date(dateTo) : undefined,
        });
        res.status(200).json({
            message: "Order statistics retrieved successfully",
            data: statistics,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to get order statistics",
        });
    }
};
exports.getOrderStatistics = getOrderStatistics;
/**
 * Controller to get order by order number
 * GET /orders/number/:orderNumber
 */
const getOrderByNumber = async (req, res) => {
    try {
        const { orderNumber } = req.params;
        const userRole = req.user.role;
        const restaurantId = userRole === "RESTAURANT" ? req.user.id : undefined;
        // Find order by order number
        const order = await prisma_1.default.order.findUnique({
            where: { orderNumber },
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
            return res.status(404).json({
                message: "Order not found",
            });
        }
        // Check restaurant ownership if restaurantId provided
        if (restaurantId && order.restaurantId !== restaurantId) {
            return res.status(403).json({
                message: "Unauthorized: Order does not belong to this restaurant",
            });
        }
        res.status(200).json({
            message: "Order retrieved successfully",
            data: order,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to get order by number",
        });
    }
};
exports.getOrderByNumber = getOrderByNumber;
