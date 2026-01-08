import express from "express";
import { sendPriceUpdateNotifications } from "../controllers/notification.controller";
import { isAuthenticated, checkPermission } from "../middleware/authMiddleware";

const router = express.Router();

router.post(
  "/price-update",
  isAuthenticated,
  checkPermission("ADMIN", "LOGISTICS", "AGGREGATOR"),
  sendPriceUpdateNotifications
);

export default router;
