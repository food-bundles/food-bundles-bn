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
  getActivePromoCodes,
  getMyPromoCodes,
  calculateCartWithPromo,
} from "../controllers/promo.controller";
import { isAuthenticated, checkPermission } from "../middleware/authMiddleware";

const router = Router();

// Public routes (no authentication required)
router.get("/active", getActivePromoCodes);

// Restaurant routes (authentication required)
router.get("/my-promos", isAuthenticated, checkPermission("RESTAURANT"), getMyPromoCodes);
router.post("/calculate-cart", isAuthenticated, checkPermission("RESTAURANT"), calculateCartWithPromo);

// Admin routes - require admin authentication
router.post("/", isAuthenticated, checkPermission("ADMIN"), createPromoCode);
router.get("/", isAuthenticated, checkPermission("ADMIN"), getAllPromoCodes);
router.get("/:id", isAuthenticated, checkPermission("ADMIN"), getPromoCodeById);
router.put("/:id", isAuthenticated, checkPermission("ADMIN"), updatePromoCode);
router.delete(
  "/:id",
  isAuthenticated,
  checkPermission("ADMIN"),
  deletePromoCode
);

// Restaurant exclusion management - admin only
router.post(
  "/:id/exclude",
  isAuthenticated,
  checkPermission("ADMIN"),
  excludeRestaurant
);
router.delete(
  "/:id/exclude/:restaurantId",
  isAuthenticated,
  checkPermission("ADMIN"),
  removeRestaurantExclusion
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
