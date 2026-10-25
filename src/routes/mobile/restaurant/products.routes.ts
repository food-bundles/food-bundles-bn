import { Router } from "express";
import { isAuthenticated, checkPermission } from "../../../middleware/authMiddleware";
import { mobileProductsList, mobileProductGet } from "../../../controllers/mobile/restaurant/products.controller";

const router = Router();
const guard = [isAuthenticated, checkPermission("RESTAURANT", "HOTEL", "AFFILIATOR")];

// GET /mobile/restaurant/products
router.get("/", ...guard, mobileProductsList);

// GET /mobile/restaurant/products/:productId
router.get("/:productId", ...guard, mobileProductGet);

export default router;
