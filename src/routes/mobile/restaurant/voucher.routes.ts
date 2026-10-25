import { Router } from "express";
import {
  isAuthenticated,
  checkPermission,
} from "../../../middleware/authMiddleware";
import { mobileVouchersList } from "../../../controllers/mobile/restaurant/voucher.controller";

const router = Router();
const guard = [
  isAuthenticated,
  checkPermission("RESTAURANT", "HOTEL", "AFFILIATOR"),
];

// GET /mobile/restaurant/vouchers
router.get("/", ...guard, mobileVouchersList);

export default router;
