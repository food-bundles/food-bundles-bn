import { Router } from "express";
import { isAuthenticated, checkPermission } from "../../../middleware/authMiddleware";
import { mobileVouchersList, mobileVoucherApply } from "../../../controllers/mobile/restaurant/voucher.controller";

const router = Router();
const guard = [isAuthenticated, checkPermission("RESTAURANT", "HOTEL", "AFFILIATOR")];

router.get("/", ...guard, mobileVouchersList);
router.post("/apply", ...guard, mobileVoucherApply);

export default router;
