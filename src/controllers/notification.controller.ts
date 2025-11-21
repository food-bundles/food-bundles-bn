import { Request, Response } from "express";
import {
  createNotificationService,
  getAllNotificationsService,
  getUserNotificationsService,
  getNotificationByIdService,
  markNotificationAsReadService,
  markAllUserNotificationsAsReadService,
  deleteNotificationService,
  getUnreadCountService,
} from "../services/notification.services";

// Create Notification (Admin only)
export const createNotification = async (req: Request, res: Response) => {
  try {
    const { title, message, eventType, targetType, targetId, targetRole, metadata } = req.body;

    if (!title || !message || !eventType || !targetType) {
      return res.status(400).json({
        message: "Title, message, eventType, and targetType are required",
      });
    }

    const notification = await createNotificationService({
      title,
      message,
      eventType,
      targetType,
      targetId,
      targetRole,
      metadata,
    });

    res.status(201).json({
      message: "Notification created successfully",
      data: notification,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to create notification",
    });
  }
};

// Get all Notifications (Admin only)
export const getAllNotifications = async (req: Request, res: Response) => {
  try {
    const { eventType, targetType, isRead, page = 1, limit = 10 } = req.query;

    const result = await getAllNotificationsService({
      eventType: eventType as string,
      targetType: targetType as string,
      isRead: isRead ? isRead === "true" : undefined,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    });

    res.status(200).json({
      message: "Notifications retrieved successfully",
      data: result.notifications,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get notifications",
    });
  }
};

// Get my notifications (for authenticated user)
export const getMyNotifications = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;
    const { page = 1, limit = 10, isRead } = req.query;

    const result = await getUserNotificationsService(userId, userRole, {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      isRead: isRead ? isRead === "true" : undefined,
    });

    res.status(200).json({
      message: "My notifications retrieved successfully",
      data: result.notifications,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get my notifications",
    });
  }
};

// Get Notification by ID
export const getNotificationById = async (req: Request, res: Response) => {
  try {
    const { notificationId } = req.params;

    const notification = await getNotificationByIdService(notificationId);

    res.status(200).json({
      message: "Notification retrieved successfully",
      data: notification,
    });
  } catch (error: any) {
    if (error.message === "Notification not found") {
      return res.status(404).json({
        message: error.message,
      });
    }

    res.status(500).json({
      message: error.message || "Failed to get notification",
    });
  }
};

// Mark notification as read
export const markAsRead = async (req: Request, res: Response) => {
  try {
    const { notificationId } = req.params;

    const notification = await markNotificationAsReadService(notificationId);

    res.status(200).json({
      message: "Notification marked as read",
      data: notification,
    });
  } catch (error: any) {
    if (error.message === "Notification not found") {
      return res.status(404).json({
        message: error.message,
      });
    }

    res.status(500).json({
      message: error.message || "Failed to mark notification as read",
    });
  }
};

// Mark all my notifications as read
export const markAllAsRead = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    const result = await markAllUserNotificationsAsReadService(userId, userRole);

    res.status(200).json({
      message: result.message,
      data: {
        updatedCount: result.updatedCount,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to mark all notifications as read",
    });
  }
};

// Delete Notification (Admin only)
export const deleteNotification = async (req: Request, res: Response) => {
  try {
    const { notificationId } = req.params;

    const result = await deleteNotificationService(notificationId);

    res.status(200).json({
      message: result.message,
    });
  } catch (error: any) {
    if (error.message === "Notification not found") {
      return res.status(404).json({
        message: error.message,
      });
    }

    res.status(500).json({
      message: error.message || "Failed to delete notification",
    });
  }
};

// Get unread count
export const getUnreadCount = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    const result = await getUnreadCountService(userId, userRole);

    res.status(200).json({
      message: "Unread count retrieved successfully",
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get unread count",
    });
  }
};