import { Router } from "express";
import { isAuthenticated, checkPermission } from "../../../middleware/authMiddleware";
import {
  mobileSubscriptionPlans,
  mobileSubscriptionCurrent,
  mobileSubscriptionCreate,
  mobileSubscriptionCancel,
  mobileSubscriptionChangePlan,
  mobileSubscriptionRenew,
  mobileSubscriptionHistory,
  mobileSubscriptionVerify,
} from "../../../controllers/mobile/restaurant/subscription.controller";

const router = Router();
const guard = [isAuthenticated, checkPermission("RESTAURANT", "HOTEL", "AFFILIATOR")];

router.get("/plans", ...guard, mobileSubscriptionPlans);
router.get("/current", ...guard, mobileSubscriptionCurrent);
router.get("/history", ...guard, mobileSubscriptionHistory);
router.get("/verify/:txRef", ...guard, mobileSubscriptionVerify);
router.post("/", ...guard, mobileSubscriptionCreate);
router.patch("/change-plan", ...guard, mobileSubscriptionChangePlan);
router.post("/renew", ...guard, mobileSubscriptionRenew);
router.delete("/", ...guard, mobileSubscriptionCancel);

export default router;
