import { Request, Response } from "express";
import { DeliveryService } from "../services/delivery.service";
import { DeliveryStatus, OrderStatus } from "@prisma/client";
import prisma from "../prisma";

/**
 * Controller to generate delivery OTP for an order
 * POST /deliveries/:orderId/otp/generate
 */
export const generateDeliveryOTP = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const restaurantId = (req as any).user.id;

    // Verify the order belongs to the restaurant
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    if (order.restaurantId !== restaurantId) {
      return res.status(403).json({
        message: "Unauthorized: Order does not belong to this restaurant",
      });
    }

    const result = await DeliveryService.createDeliveryOTP(orderId);

    if (!result.success) {
      return res.status(400).json({
        message: result.message,
      });
    }

    res.status(200).json({
      message: result.message,
      data: {
        orderId,
        expiresIn: "24 hours",
      },
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to generate delivery OTP",
    });
  }
};

/**
 * Controller to resend delivery OTP
 * POST /deliveries/:orderId/otp/resend
 */
export const resendDeliveryOTP = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const restaurantId = (req as any).user.id;

    // Verify the order belongs to the restaurant
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    if (order.restaurantId !== restaurantId) {
      return res.status(403).json({
        message: "Unauthorized: Order does not belong to this restaurant",
      });
    }

    const result = await DeliveryService.resendDeliveryOTP(orderId);

    if (!result.success) {
      return res.status(400).json({
        message: result.message,
      });
    }

    res.status(200).json({
      message: result.message,
      data: {
        orderId,
        expiresIn: "24 hours",
      },
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to resend delivery OTP",
    });
  }
};

/**
 * Controller to verify delivery OTP (for logistics)
 * POST /deliveries/:orderId/otp/verify
 */
export const verifyDeliveryOTP = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { otp } = req.body;
    const logisticsId = (req as any).user.id;

    if (!otp) {
      return res.status(400).json({
        message: "OTP is required",
      });
    }

    const result = await DeliveryService.verifyDeliveryOTP(
      orderId,
      otp,
      logisticsId
    );

    if (!result.success) {
      return res.status(400).json({
        message: result.message,
      });
    }

    res.status(200).json({
      message: result.message,
      data: {
        orderId,
        status: "DELIVERED",
      },
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to verify delivery OTP",
    });
  }
};

/**
 * Controller to get orders available for logistics
 * GET /deliveries/orders
 */
export const getLogisticsOrders = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const result = await DeliveryService.getLogisticsOrders({
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      status: status as OrderStatus,
    });

    res.status(200).json({
      message: "Logistics orders retrieved successfully",
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
      message: error.message || "Failed to get logistics orders",
    });
  }
};

/**
 * Controller to update delivery status
 * PATCH /deliveries/:orderId/status
 */
export const updateDeliveryStatus = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { status, notes } = req.body;
    const logisticsId = (req as any).user.id;

    if (!status) {
      return res.status(400).json({
        message: "Status is required",
      });
    }

    if (!Object.values(DeliveryStatus).includes(status)) {
      return res.status(400).json({
        message: "Invalid delivery status",
      });
    }

    const result = await DeliveryService.updateDeliveryStatus(
      orderId,
      status,
      logisticsId,
      notes
    );

    if (!result.success) {
      return res.status(400).json({
        message: result.message,
      });
    }

    res.status(200).json({
      message: result.message,
      data: {
        orderId,
        status,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to update delivery status",
    });
  }
};

/**
 * Controller to get delivery details
 * GET /deliveries/:orderId
 */
export const getDeliveryDetails = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    const delivery = await DeliveryService.getOrderDeliveryDetails(orderId);

    res.status(200).json({
      message: "Delivery details retrieved successfully",
      data: delivery,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get delivery details",
    });
  }
};

/**
 * Controller to get delivery OTP status
 * GET /deliveries/:orderId/otp/status
 */
export const getDeliveryOTPStatus = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const restaurantId = (req as any).user.id;

    // Verify the order belongs to the restaurant
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    if (order.restaurantId !== restaurantId) {
      return res.status(403).json({
        message: "Unauthorized: Order does not belong to this restaurant",
      });
    }

    const otpStatus = await DeliveryService.getDeliveryOTPStatus(orderId);

    res.status(200).json({
      message: "Delivery OTP status retrieved successfully",
      data: otpStatus,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get delivery OTP status",
    });
  }
};
