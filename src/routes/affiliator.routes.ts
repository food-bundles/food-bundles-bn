import { Router } from "express";
import {
  createAffiliator,
  getMyAffiliators,
  getAllAffiliators,
  getAffiliatorById,
  updateAffiliator,
  deleteAffiliator,
} from "../controllers/affiliator.controller";
import { isAuthenticated, checkPermission } from "../middleware/authMiddleware";

const affiliatorRoutes = Router();

/**
 * Create new affiliator (Restaurant only)
 * POST /affiliators
 */
affiliatorRoutes.post(
  "/",
  isAuthenticated,
  checkPermission("RESTAURANT"),
  createAffiliator
);

/**
 * Get restaurant's affiliators
 * GET /affiliators/my-affiliators
 */
affiliatorRoutes.get(
  "/my-affiliators",
  isAuthenticated,
  checkPermission("RESTAURANT"),
  getMyAffiliators
);

/**
 * Get all affiliators (Admin only)
 * GET /affiliators
 */
affiliatorRoutes.get(
  "/",
  isAuthenticated,
  checkPermission("ADMIN"),
  getAllAffiliators
);

/**
 * Get affiliator by ID
 * GET /affiliators/:id
 */
affiliatorRoutes.get("/:id", isAuthenticated, getAffiliatorById);

/**
 * Update affiliator
 * PATCH /affiliators/:id
 */
affiliatorRoutes.patch("/:id", isAuthenticated, updateAffiliator);

/**
 * Delete affiliator
 * DELETE /affiliators/:id
 */
affiliatorRoutes.delete("/:id", isAuthenticated, deleteAffiliator);

export default affiliatorRoutes;
