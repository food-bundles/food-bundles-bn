import { Router } from "express";
import { isAuthenticated, checkPermission } from "../../../middleware/authMiddleware";
import {
  mobileNotificationsList,
  mobileNotificationsUnreadCount,
  mobileNotificationMarkRead,
  mobileNotificationMarkAllRead,
} from "../../../controllers/mobile/restaurant/notification.controller";

const router = Router();
const guard = [isAuthenticated, checkPermission("RESTAURANT", "HOTEL", "AFFILIATOR")];

// GET /mobile/restaurant/notifications
router.get("/", ...guard, mobileNotificationsList);

// GET /mobile/restaurant/notifications/unread-count
router.get("/unread-count", ...guard, mobileNotificationsUnreadCount);

// PATCH /mobile/restaurant/notifications/mark-all-read
router.patch("/mark-all-read", ...guard, mobileNotificationMarkAllRead);

// PATCH /mobile/restaurant/notifications/:notificationId/read
router.patch("/:notificationId/read", ...guard, mobileNotificationMarkRead);

export default router;
