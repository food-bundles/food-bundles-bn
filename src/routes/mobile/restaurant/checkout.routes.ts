import { Router } from "express";
import { isAuthenticated, checkPermission } from "../../../middleware/authMiddleware";
import {
  mobileCheckoutCreate,
  mobileCheckoutVerifyOtp,
  mobileCheckoutStatus,
  mobileGetLoanSessionsCtrl,
  mobileAdminOrderCreate,
} from "../../../controllers/mobile/restaurant/checkout.controller";

const router = Router();
const guard = [isAuthenticated, checkPermission("RESTAURANT", "HOTEL", "AFFILIATOR")];

// Static routes MUST come before parameterised ones to avoid collision

// GET  /mobile/restaurant/checkouts/loan-sessions
router.get("/loan-sessions", ...guard, mobileGetLoanSessionsCtrl);

// POST /mobile/restaurant/checkouts
router.post("/", ...guard, mobileCheckoutCreate);

// POST /mobile/restaurant/checkouts/verify-voucher-otp
router.post("/verify-voucher-otp", ...guard, mobileCheckoutVerifyOtp);

// POST /mobile/restaurant/checkouts/admin-order
router.post("/admin-order", ...guard, mobileAdminOrderCreate);

// GET  /mobile/restaurant/checkouts/:orderId/status
router.get("/:orderId/status", ...guard, mobileCheckoutStatus);

export default router;
