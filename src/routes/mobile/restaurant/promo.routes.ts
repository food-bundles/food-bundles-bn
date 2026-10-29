import { Router } from "express";
import { isAuthenticated, checkPermission } from "../../../middleware/authMiddleware";
import {
  calculatePromoController,
  getMyPromoCodesController,
} from "../../../controllers/mobile/restaurant/promo.controller";

const router = Router();
const guard = [isAuthenticated, checkPermission("RESTAURANT", "HOTEL", "AFFILIATOR")];

router.post("/calculate", ...guard, calculatePromoController);
router.get("/my", ...guard, getMyPromoCodesController);

export default router;
