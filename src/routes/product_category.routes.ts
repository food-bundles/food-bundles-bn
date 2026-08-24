import { Router } from "express";
import {
  createProductCategory,
  getAllProductCategories,
  getActiveProductCategories,
  getProductCategoryById,
  updateProductCategory,
  deleteProductCategory,
  updateCategoryStatus,
} from "../controllers/product_category.controller";
import { isAuthenticated, checkPermission } from "../middleware/authMiddleware";

const productCategoryRoutes = Router();

// Get active categories for dropdown/selection (accessible to authenticated users)
productCategoryRoutes.get("/active", getActiveProductCategories);

// Bulk update category status (Admin only)
productCategoryRoutes.patch(
  "/bulk-status",
  isAuthenticated,
  checkPermission("ADMIN", "MARKET_PRICES"),
  updateCategoryStatus
);

// Create new product category (Admin only)
productCategoryRoutes.post(
  "/",
  isAuthenticated,
  checkPermission("ADMIN", "MARKET_PRICES"),
  createProductCategory
);

// Get all product categories with filtering and pagination
productCategoryRoutes.get(
  "/",
  isAuthenticated,
  checkPermission("ADMIN", "MARKET_PRICES", "AGGREGATOR", "LOGISTICS"),
  getAllProductCategories
);

// Get product category by ID
productCategoryRoutes.get("/:categoryId", getProductCategoryById);

// Update product category (Admin only)
productCategoryRoutes.patch(
  "/:categoryId",
  isAuthenticated,
  checkPermission("ADMIN", "MARKET_PRICES"),
  updateProductCategory
);

// Delete product category (Admin only)
productCategoryRoutes.delete(
  "/:categoryId",
  isAuthenticated,
  checkPermission("ADMIN", "MARKET_PRICES"),
  deleteProductCategory
);

export default productCategoryRoutes;
