import { Router } from "express";
import { isAuthenticated, checkPermission } from "../../../middleware/authMiddleware";
import { mobileGetPaymentMethods, mobileGetDeliveryFee } from "../../../controllers/mobile/restaurant/config.controller";

const router = Router();
const guard = [isAuthenticated, checkPermission("RESTAURANT", "HOTEL", "AFFILIATOR")];

// GET /mobile/restaurant/config/delivery-fee
router.get("/delivery-fee", ...guard, mobileGetDeliveryFee);

// GET /mobile/restaurant/config/payment-methods
router.get("/payment-methods", ...guard, mobileGetPaymentMethods);

export default router;
