import { Router } from "express";
import { isAuthenticated, checkPermission } from "../../../middleware/authMiddleware";
import {
  mobileProductsList,
  mobileProductGet,
  mobileProductCategories,
} from "../../../controllers/mobile/restaurant/products.controller";

const router = Router();
const guard = [isAuthenticated, checkPermission("RESTAURANT", "HOTEL", "AFFILIATOR")];

// GET /mobile/restaurant/products/categories  — must be before /:productId
router.get("/categories", ...guard, mobileProductCategories);

// GET /mobile/restaurant/products
router.get("/", ...guard, mobileProductsList);

// GET /mobile/restaurant/products/:productId
router.get("/:productId", ...guard, mobileProductGet);

export default router;
