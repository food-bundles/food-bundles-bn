import { Router } from "express";
import {
  exportData,
  getExportTypes,
} from "../controllers/export.controller";
import { isAuthenticated, checkPermission } from "../middleware/authMiddleware";

const exportRoutes = Router();

// Get available export types and formats (Admin only)
exportRoutes.get(
  "/types",
  isAuthenticated,
  checkPermission("ADMIN"),
  getExportTypes
);

// Export data in specified format (Admin only)
exportRoutes.get(
  "/:type/:format",
  isAuthenticated,
  checkPermission("ADMIN"),
  exportData
);

export default exportRoutes;