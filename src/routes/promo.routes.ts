import { Router } from "express";
import {
  createPromoCode,
  getAllPromoCodes,
  getPromoCodeById,
  getPromoCodeByCode,
  updatePromoCode,
  deletePromoCode,
  validatePromoCode,
  applyPromoCode,
  excludeRestaurant,
  removeRestaurantExclusion,
  includeRestaurant,
  removeRestaurantInclusion,
  getActivePromoCodes,
  getMyPromoCodes,
  calculateCartWithPromo,
} from "../controllers/promo.controller";
import { isAuthenticated, checkPermission, allow } from "../middleware/authMiddleware";

const router = Router();

// Public routes (no authentication required)
router.get("/active", getActivePromoCodes);

// Restaurant routes (authentication required)
router.get("/my-promos", isAuthenticated, checkPermission("RESTAURANT"), getMyPromoCodes);
router.post("/calculate-cart", isAuthenticated, checkPermission("RESTAURANT"), calculateCartWithPromo);

// Admin routes - require admin authentication
router.post("/", isAuthenticated, allow("promo_codes"), createPromoCode);
router.get("/", isAuthenticated, allow("promo_codes"), getAllPromoCodes);
router.get("/:id", isAuthenticated, allow("promo_codes"), getPromoCodeById);
router.put("/:id", isAuthenticated, allow("promo_codes"), updatePromoCode);
router.delete(
  "/:id",
  isAuthenticated,
  allow("promo_codes"),
  deletePromoCode
);

// Restaurant exclusion management - admin only
router.post(
  "/:id/exclude",
  isAuthenticated,
  allow("promo_codes"),
  excludeRestaurant
);
router.delete(
  "/:id/exclude/:restaurantId",
  isAuthenticated,
  allow("promo_codes"),
  removeRestaurantExclusion
);

// Restaurant inclusion management - admin only
router.post(
  "/:id/include",
  isAuthenticated,
  allow("promo_codes"),
  includeRestaurant
);
router.delete(
  "/:id/include/:restaurantId",
  isAuthenticated,
  allow("promo_codes"),
  removeRestaurantInclusion
);

// Restaurant routes - require restaurant authentication
router.get(
  "/code/:code",
  isAuthenticated,
  checkPermission("RESTAURANT"),
  getPromoCodeByCode
);
router.post(
  "/validate/:code",
  isAuthenticated,
  checkPermission("RESTAURANT"),
  validatePromoCode
);
router.post(
  "/apply/:code",
  isAuthenticated,
  checkPermission("RESTAURANT"),
  applyPromoCode
);

export default router;
