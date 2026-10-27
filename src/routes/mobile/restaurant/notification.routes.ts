import { Router } from "express";
import { isAuthenticated, checkPermission } from "../../../middleware/authMiddleware";
import {
  mobileNotificationsList,
  mobileNotificationsUnreadCount,
  mobileNotificationMarkRead,
  mobileNotificationMarkAllRead,
  mobileGetPriceAlerts,
  mobileUpsertPriceAlert,
  mobileDeletePriceAlert,
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

// GET /mobile/restaurant/notifications/price-alerts
router.get("/price-alerts", ...guard, mobileGetPriceAlerts);

// PUT /mobile/restaurant/notifications/price-alerts/:productId
router.put("/price-alerts/:productId", ...guard, mobileUpsertPriceAlert);

// DELETE /mobile/restaurant/notifications/price-alerts/:productId
router.delete("/price-alerts/:productId", ...guard, mobileDeletePriceAlert);

export default router;
