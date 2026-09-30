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
import { isAuthenticated, allow } from "../middleware/authMiddleware";

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
  allow("sms_recipients"),
  createNotification
);

// Get all notifications (Admin only)
notificationRoutes.get(
  "/",
  isAuthenticated,
  allow("sms_recipients"),
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
  allow("sms_recipients"),
  deleteNotification
);

notificationRoutes.post(
  "/price-update",
  isAuthenticated,
  allow("markets", "LOGISTICS", "AGGREGATOR"),
  sendPriceUpdateNotifications
);

export default notificationRoutes;
