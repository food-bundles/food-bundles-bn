import { Router } from "express";
import { isAuthenticated, checkPermission } from "../../../middleware/authMiddleware";
import {
  mobileAffiliatorsList,
  mobileAffiliatorCreate,
  mobileAffiliatorDelete,
  mobileAffiliatorGet,
  mobileAffiliatorUpdate,
} from "../../../controllers/mobile/restaurant/affiliator.controller";

const router = Router();
const guard = [isAuthenticated, checkPermission("RESTAURANT", "HOTEL")];

// GET    /mobile/restaurant/affiliators
router.get("/", ...guard, mobileAffiliatorsList);

// POST   /mobile/restaurant/affiliators
router.post("/", ...guard, mobileAffiliatorCreate);

// GET    /mobile/restaurant/affiliators/:affiliatorId
router.get("/:affiliatorId", ...guard, mobileAffiliatorGet);

// PATCH  /mobile/restaurant/affiliators/:affiliatorId
router.patch("/:affiliatorId", ...guard, mobileAffiliatorUpdate);

// DELETE /mobile/restaurant/affiliators/:affiliatorId
router.delete("/:affiliatorId", ...guard, mobileAffiliatorDelete);

export default router;
