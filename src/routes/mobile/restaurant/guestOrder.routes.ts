import { Router } from "express";
import { mobileCreateGuestOrder } from "../../../controllers/mobile/restaurant/guestOrder.controller";

const router = Router();

// POST /mobile/restaurant/guest/orders
router.post("/orders", mobileCreateGuestOrder);

export default router;
