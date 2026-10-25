import { Request, Response } from "express";
import { OrderStatus, PaymentStatus } from "@prisma/client";
import {
  mobileGetMyOrders,
  mobileGetOrderById,
  mobileCancelOrder,
  mobileReorder,
  mobileGetOrderStats,
} from "../../../services/mobile/restaurant/order.service";

const user = (req: Request) => (req as any).user;

const restaurantId = (req: Request) => {
  const u = user(req);
  return u.role === "RESTAURANT" || u.role === "HOTEL" ? u.id : u.restaurantId;
};

export const mobileOrdersList = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      paymentStatus,
      dateFrom,
      dateTo,
    } = req.query;
    if (status && !Object.values(OrderStatus).includes(status as OrderStatus))
      return res.status(400).json({ message: "Invalid order status" });
    const result = await mobileGetMyOrders(restaurantId(req), {
      page: Number(page),
      limit: Number(limit),
      status: status as OrderStatus,
      paymentStatus: paymentStatus as PaymentStatus,
      dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo: dateTo ? new Date(dateTo as string) : undefined,
    });
    res
      .status(200)
      .json({
        message: "Orders retrieved",
        data: result.orders,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        },
      });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to get orders" });
  }
};

export const mobileOrderGet = async (req: Request, res: Response) => {
  try {
    const order = await mobileGetOrderById(
      req.params.orderId,
      restaurantId(req),
    );
    res.status(200).json({ message: "Order retrieved", data: order });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to get order" });
  }
};

export const mobileOrderCancel = async (req: Request, res: Response) => {
  try {
    const result = await mobileCancelOrder(
      req.params.orderId,
      restaurantId(req),
      req.body.reason,
    );
    res.status(200).json({ message: result.message });
  } catch (error: any) {
    res
      .status(500)
      .json({ message: error.message || "Failed to cancel order" });
  }
};

export const mobileOrderReorder = async (req: Request, res: Response) => {
  try {
    const result = await mobileReorder(
      req.params.orderId,
      restaurantId(req),
      req.body.paymentMethodId,
    );
    if (result.success) {
      res
        .status(200)
        .json({ message: result.message || "Reorder processed", data: result });
    } else {
      res
        .status(400)
        .json({ message: (result as any).error || "Reorder failed" });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to reorder" });
  }
};

export const mobileOrderStats = async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const stats = await mobileGetOrderStats(
      restaurantId(req),
      dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo ? new Date(dateTo as string) : undefined,
    );
    res
      .status(200)
      .json({ message: "Order statistics retrieved", data: stats });
  } catch (error: any) {
    res
      .status(500)
      .json({ message: error.message || "Failed to get order statistics" });
  }
};
