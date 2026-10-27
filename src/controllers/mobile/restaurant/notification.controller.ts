import { Request, Response } from "express";
import {
  mobileGetNotifications,
  mobileGetUnreadCount,
  mobileMarkRead,
  mobileMarkAllRead,
} from "../../../services/mobile/restaurant/notification.service";

const user = (req: Request) => (req as any).user;

export const mobileNotificationsList = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, isRead } = req.query;
    const result = await mobileGetNotifications(user(req).id, user(req).role, {
      page: Number(page),
      limit: Number(limit),
      isRead: isRead !== undefined ? isRead === "true" : undefined,
    });
    res
      .status(200)
      .json({
        message: "Notifications retrieved",
        data: result.notifications,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        },
      });
  } catch (error: any) {
    res
      .status(500)
      .json({ message: error.message || "Failed to get notifications" });
  }
};

export const mobileNotificationsUnreadCount = async (
  req: Request,
  res: Response,
) => {
  try {
    const result = await mobileGetUnreadCount(user(req).id, user(req).role);
    res.status(200).json({ data: result });
  } catch (error: any) {
    res
      .status(500)
      .json({ message: error.message || "Failed to get unread count" });
  }
};

export const mobileNotificationMarkRead = async (
  req: Request,
  res: Response,
) => {
  try {
    const notification = await mobileMarkRead(req.params.notificationId);
    res
      .status(200)
      .json({ message: "Notification marked as read", data: notification });
  } catch (error: any) {
    res
      .status(500)
      .json({ message: error.message || "Failed to mark notification" });
  }
};

export const mobileNotificationMarkAllRead = async (
  req: Request,
  res: Response,
) => {
  try {
    const result = await mobileMarkAllRead(user(req).id, user(req).role);
    res.status(200).json({ message: result.message });
  } catch (error: any) {
    res
      .status(500)
      .json({ message: error.message || "Failed to mark all notifications" });
  }
};

// ─── Price Alerts ─────────────────────────────────────────────────────────────
// Stored as JSON in restaurant.priceAlerts (optional field, no migration needed)

import prisma from "../../../prisma";

const PRICE_ALERTS_KEY = "priceAlerts";

async function getAlerts(restaurantId: string): Promise<any[]> {
  const r = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { priceAlerts: true },
  });
  const raw = r?.priceAlerts;
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [];
}

// GET /mobile/restaurant/notifications/price-alerts
export const mobileGetPriceAlerts = async (req: Request, res: Response) => {
  try {
    const me = (req as any).user;
    const alerts = await getAlerts(me.id);
    res.json({ message: "Price alerts retrieved", data: alerts });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to get price alerts" });
  }
};

// PUT /mobile/restaurant/notifications/price-alerts/:productId
export const mobileUpsertPriceAlert = async (req: Request, res: Response) => {
  try {
    const me = (req as any).user;
    const { productId } = req.params;
    const { thresholdRwf, direction } = req.body;
    if (!thresholdRwf || !direction) {
      return res.status(400).json({ message: "thresholdRwf and direction are required" });
    }
    const existing = await getAlerts(me.id);
    const updated = [
      ...existing.filter((a: any) => a.productId !== productId),
      { productId, thresholdRwf: Number(thresholdRwf), direction },
    ];
    await prisma.restaurant.update({
      where: { id: me.id },
      data: { priceAlerts: updated },
    });
    res.json({ message: "Price alert saved", data: { productId, thresholdRwf, direction } });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to save price alert" });
  }
};

// DELETE /mobile/restaurant/notifications/price-alerts/:productId
export const mobileDeletePriceAlert = async (req: Request, res: Response) => {
  try {
    const me = (req as any).user;
    const { productId } = req.params;
    const existing = await getAlerts(me.id);
    const updated = existing.filter((a: any) => a.productId !== productId);
    await prisma.restaurant.update({
      where: { id: me.id },
      data: { priceAlerts: updated },
    });
    res.json({ message: "Price alert deleted" });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to delete price alert" });
  }
};
