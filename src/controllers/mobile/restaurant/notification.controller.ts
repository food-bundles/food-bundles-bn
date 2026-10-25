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
