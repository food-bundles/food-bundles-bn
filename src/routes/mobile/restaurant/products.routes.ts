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

// Public — guest shop needs product listing without a token
router.get("/", mobileProductsList);
router.get("/:productId", mobileProductGet);

export default router;
