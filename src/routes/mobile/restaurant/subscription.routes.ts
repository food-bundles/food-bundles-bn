import { Router } from "express";
import { isAuthenticated, checkPermission } from "../../../middleware/authMiddleware";
import {
  mobileSubscriptionPlans,
  mobileSubscriptionCurrent,
  mobileSubscriptionCreate,
  mobileSubscriptionCancel,
} from "../../../controllers/mobile/restaurant/subscription.controller";

const router = Router();
const guard = [isAuthenticated, checkPermission("RESTAURANT", "HOTEL", "AFFILIATOR")];

// GET  /mobile/restaurant/subscriptions/plans
router.get("/plans", ...guard, mobileSubscriptionPlans);

// GET  /mobile/restaurant/subscriptions/current
router.get("/current", ...guard, mobileSubscriptionCurrent);

// POST /mobile/restaurant/subscriptions
router.post("/", ...guard, mobileSubscriptionCreate);

// DELETE /mobile/restaurant/subscriptions
router.delete("/", ...guard, mobileSubscriptionCancel);

export default router;
