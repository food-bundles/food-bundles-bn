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
import { isAuthenticated, allow } from "../middleware/authMiddleware";

const unitRoutes = Router();

// Get active units for dropdown/selection (accessible to authenticated users)
unitRoutes.get("/active", getActiveProductUnits);

// Bulk update unit status (Admin only)
unitRoutes.patch(
  "/bulk-status",
  isAuthenticated,
  allow("units"),
  updateUnitStatus
);

// Create new product unit (Admin only)
unitRoutes.post(
  "/",
  isAuthenticated,
  allow("units"),
  createProductUnit
);

// Get all product units with filtering and pagination
unitRoutes.get(
  "/",
  isAuthenticated,
  allow(["units", "products"], "AGGREGATOR", "LOGISTICS"),
  getAllProductUnits
);

// Get product unit by ID
unitRoutes.get("/:unitId", getProductUnitById);

// Update product unit (Admin only)
unitRoutes.patch(
  "/:unitId",
  isAuthenticated,
  allow("units"),
  updateProductUnit
);

// Delete product unit (Admin only)
unitRoutes.delete(
  "/:unitId",
  isAuthenticated,
  allow("units"),
  deleteProductUnit
);

export default unitRoutes;