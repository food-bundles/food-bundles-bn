import { Router } from "express";
import { sendPriceUpdateNotifications } from "../controllers/notification.controller";
import {
  createNotification,
  getAllNotifications,
  getMyNotifications,
  getNotificationById,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount,
} from "../controllers/notification.controller";
import { isAuthenticated, checkPermission } from "../middleware/authMiddleware";

const notificationRoutes = Router();

// Get my notifications (for authenticated user)
notificationRoutes.get(
  "/my-notifications",
  isAuthenticated,
  getMyNotifications
);

// Get unread count (for authenticated user)
notificationRoutes.get("/unread-count", isAuthenticated, getUnreadCount);

// Mark all my notifications as read (for authenticated user)
notificationRoutes.patch("/mark-all-read", isAuthenticated, markAllAsRead);

// Create new notification (Admin only)
notificationRoutes.post(
  "/",
  isAuthenticated,
  checkPermission("ADMIN"),
  createNotification
);

// Get all notifications (Admin only)
notificationRoutes.get(
  "/",
  isAuthenticated,
  checkPermission("ADMIN"),
  getAllNotifications
);

// Get notification by ID
notificationRoutes.get(
  "/:notificationId",
  isAuthenticated,
  getNotificationById
);

// Mark notification as read
notificationRoutes.patch("/:notificationId/read", isAuthenticated, markAsRead);

// Delete notification (Admin only)
notificationRoutes.delete(
  "/:notificationId",
  isAuthenticated,
  checkPermission("ADMIN"),
  deleteNotification
);

notificationRoutes.post(
  "/price-update",
  isAuthenticated,
  checkPermission("ADMIN", "LOGISTICS", "AGGREGATOR"),
  sendPriceUpdateNotifications
);

export default notificationRoutes;
