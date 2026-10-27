import { Router } from "express";
import { isAuthenticated, checkPermission } from "../../../middleware/authMiddleware";
import {
  mobileOrdersList,
  mobileOrderGet,
  mobileOrderCancel,
  mobileOrderReorder,
  mobileOrderStats,
} from "../../../controllers/mobile/restaurant/order.controller";

const router = Router();
const guard = [isAuthenticated, checkPermission("RESTAURANT", "HOTEL", "AFFILIATOR")];

// GET /mobile/restaurant/orders/statistics
router.get("/statistics", ...guard, mobileOrderStats);

// GET /mobile/restaurant/orders
router.get("/", ...guard, mobileOrdersList);

// GET /mobile/restaurant/orders/:orderId
router.get("/:orderId", ...guard, mobileOrderGet);

// POST /mobile/restaurant/orders/:orderId/cancel
router.post("/:orderId/cancel", ...guard, mobileOrderCancel);

// POST /mobile/restaurant/orders/:orderId/reorder
router.post("/:orderId/reorder", ...guard, mobileOrderReorder);

export default router;
