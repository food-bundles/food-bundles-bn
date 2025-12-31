import { Router } from "express";
import {
  createProductUnit,
  getAllProductUnits,
  getActiveProductUnits,
  getProductUnitById,
  updateProductUnit,
  deleteProductUnit,
  updateUnitStatus,
} from "../controllers/unit.controller";
import { isAuthenticated, checkPermission } from "../middleware/authMiddleware";

const unitRoutes = Router();

// Get active units for dropdown/selection (accessible to authenticated users)
unitRoutes.get("/active", getActiveProductUnits);

// Bulk update unit status (Admin only)
unitRoutes.patch(
  "/bulk-status",
  isAuthenticated,
  checkPermission("ADMIN"),
  updateUnitStatus
);

// Create new product unit (Admin only)
unitRoutes.post(
  "/",
  isAuthenticated,
  checkPermission("ADMIN"),
  createProductUnit
);

// Get all product units with filtering and pagination
unitRoutes.get(
  "/",
  isAuthenticated,
  checkPermission("ADMIN", "AGGREGATOR", "LOGISTICS"),
  getAllProductUnits
);

// Get product unit by ID
unitRoutes.get("/:unitId", getProductUnitById);

// Update product unit (Admin only)
unitRoutes.patch(
  "/:unitId",
  isAuthenticated,
  checkPermission("ADMIN"),
  updateProductUnit
);

// Delete product unit (Admin only)
unitRoutes.delete(
  "/:unitId",
  isAuthenticated,
  checkPermission("ADMIN"),
  deleteProductUnit
);

export default unitRoutes;