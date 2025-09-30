import { Request, Response } from "express";
import {
  createDirectOrderService,
  getOrderByIdService,
  getAllOrdersService,
  getRestaurantOrdersService,
  updateOrderService,
  cancelOrderService,
  deleteOrderService,
  getOrderStatisticsService,
  createOrderFromCartService,
} from "../services/order.services";
import { OrderStatus, PaymentMethod, PaymentStatus } from "@prisma/client";
import prisma from "../prisma";

/**
 * Controller to create order from cart
 * POST /orders/from-cart
 */
export const createOrderFromCart = async (req: Request, res: Response) => {
  try {
    const { cartId, notes, requestedDelivery } = req.body;
    const restaurantId = (req as any).user.id;

    // Validate required fields
    if (!cartId) {
      return res.status(400).json({
        message: "Checkout ID is required",
      });
    }

    const order = await createOrderFromCartService({
      cartId,
      restaurantId,
      notes,
      status: OrderStatus.PENDING,
      requestedDelivery: requestedDelivery
        ? new Date(requestedDelivery)
        : undefined,
    });

    res.status(201).json({
      message: "Order created from cart successfully",
      data: order,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to create order from cart",
    });
  }
};

/**
 * Controller to create direct order
 * POST /orders/direct
 */
export const createDirectOrder = async (req: Request, res: Response) => {
  try {
    const { items, paymentMethod, notes, requestedDelivery } = req.body;
    const userRole = (req as any).user.role;
    const restaurantId =
      userRole === "RESTAURANT" ? (req as any).user.id : req.body.restaurantId;

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
    if (
      paymentMethod &&
      !Object.values(PaymentMethod).includes(paymentMethod)
    ) {
      return res.status(400).json({
        message: "Invalid payment method",
      });
    }

    const order = await createDirectOrderService({
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
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to create direct order",
    });
  }
};

/**
 * Controller to get order by ID
 * GET /orders/:orderId
 */
export const getOrderById = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const userRole = (req as any).user.role;
    const restaurantId =
      userRole === "RESTAURANT" ? (req as any).user.id : undefined;

    const order = await getOrderByIdService(orderId, restaurantId);

    res.status(200).json({
      message: "Order retrieved successfully",
      data: order,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get order",
    });
  }
};

/**
 * Controller to get all orders (Admin only)
 * GET /orders
 */
export const getAllOrders = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      paymentStatus,
      restaurantId,
      dateFrom,
      dateTo,
    } = req.query;

    // Validate status if provided
    if (status && !Object.values(OrderStatus).includes(status as OrderStatus)) {
      return res.status(400).json({
        message: "Invalid order status",
      });
    }

    // Validate payment status if provided
    if (
      paymentStatus &&
      !Object.values(PaymentStatus).includes(paymentStatus as PaymentStatus)
    ) {
      return res.status(400).json({
        message: "Invalid payment status",
      });
    }

    const result = await getAllOrdersService({
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      status: status as OrderStatus,
      paymentStatus: paymentStatus as PaymentStatus,
      restaurantId: restaurantId as string,
      dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo: dateTo ? new Date(dateTo as string) : undefined,
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
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get orders",
    });
  }
};

/**
 * Controller to get restaurant's orders
 * GET /orders/my-orders
 */
export const getMyOrders = async (req: Request, res: Response) => {
  try {
    const restaurantId = (req as any).user.id;
    const {
      page = 1,
      limit = 10,
      status,
      paymentStatus,
      dateFrom,
      dateTo,
    } = req.query;

    // Validate status if provided
    if (status && !Object.values(OrderStatus).includes(status as OrderStatus)) {
      return res.status(400).json({
        message: "Invalid order status",
      });
    }

    // Validate payment status if provided
    if (
      paymentStatus &&
      !Object.values(PaymentStatus).includes(paymentStatus as PaymentStatus)
    ) {
      return res.status(400).json({
        message: "Invalid payment status",
      });
    }

    const result = await getRestaurantOrdersService(restaurantId, {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      status: status as OrderStatus,
      paymentStatus: paymentStatus as PaymentStatus,
      dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo: dateTo ? new Date(dateTo as string) : undefined,
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
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get orders",
    });
  }
};

/**
 * Controller to update order
 * PATCH /orders/:orderId
 */
export const updateOrder = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const {
      status,
      notes,
      requestedDelivery,
      estimatedDelivery,
      actualDelivery,
      paymentMethod,
      paymentStatus,
      paymentReference,
    } = req.body;

    const userRole = (req as any).user.role;
    const restaurantId =
      userRole === "RESTAURANT" ? (req as any).user.id : undefined;

    // Validate status if provided
    if (status && !Object.values(OrderStatus).includes(status)) {
      return res.status(400).json({
        message: "Invalid order status",
      });
    }

    // Validate payment status if provided
    if (
      paymentStatus &&
      !Object.values(PaymentStatus).includes(paymentStatus)
    ) {
      return res.status(400).json({
        message: "Invalid payment status",
      });
    }

    // Validate payment method if provided
    if (
      paymentMethod &&
      !Object.values(PaymentMethod).includes(paymentMethod)
    ) {
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

    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (requestedDelivery !== undefined)
      updateData.requestedDelivery = new Date(requestedDelivery);
    if (estimatedDelivery !== undefined)
      updateData.estimatedDelivery = new Date(estimatedDelivery);
    if (actualDelivery !== undefined)
      updateData.actualDelivery = new Date(actualDelivery);
    if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;
    if (paymentStatus !== undefined) updateData.paymentStatus = paymentStatus;
    if (paymentReference !== undefined)
      updateData.paymentReference = paymentReference;

    const updatedOrder = await updateOrderService(
      orderId,
      updateData,
      restaurantId
    );

    res.status(200).json({
      message: "Order updated successfully",
      data: updatedOrder,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to update order",
    });
  }
};

/**
 * Controller to cancel order
 * POST /orders/:orderId/cancel
 */
export const cancelOrder = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    const userRole = (req as any).user.role;
    const restaurantId =
      userRole === "RESTAURANT" ? (req as any).user.id : undefined;

    const result = await cancelOrderService(orderId, restaurantId, reason);

    res.status(200).json({
      message: result.message,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to cancel order",
    });
  }
};

/**
 * Controller to delete order (Admin only)
 * DELETE /orders/:orderId
 */
export const deleteOrder = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    const result = await deleteOrderService(orderId);

    res.status(200).json({
      message: result.message,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to delete order",
    });
  }
};

/**
 * Controller to get order statistics
 * GET /orders/statistics
 */
export const getOrderStatistics = async (req: Request, res: Response) => {
  try {
    const { restaurantId, dateFrom, dateTo } = req.query;
    const userRole = (req as any).user.role;

    // If user is restaurant, only show their statistics
    const targetRestaurantId =
      userRole === "RESTAURANT"
        ? (req as any).user.id
        : (restaurantId as string);

    const statistics = await getOrderStatisticsService({
      restaurantId: targetRestaurantId,
      dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo: dateTo ? new Date(dateTo as string) : undefined,
    });

    res.status(200).json({
      message: "Order statistics retrieved successfully",
      data: statistics,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get order statistics",
    });
  }
};

/**
 * Controller to get order by order number
 * GET /orders/number/:orderNumber
 */
export const getOrderByNumber = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const userRole = (req as any).user.role;
    const restaurantId =
      userRole === "RESTAURANT" ? (req as any).user.id : undefined;

    // Find order by order number
    const order = await prisma.order.findUnique({
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
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get order by number",
    });
  }
};
