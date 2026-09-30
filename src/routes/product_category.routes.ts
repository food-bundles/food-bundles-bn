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
import { isAuthenticated, allow } from "../middleware/authMiddleware";

const productCategoryRoutes = Router();

// Get active categories for dropdown/selection (accessible to authenticated users)
productCategoryRoutes.get("/active", getActiveProductCategories);

// Bulk update category status (Admin only)
productCategoryRoutes.patch(
  "/bulk-status",
  isAuthenticated,
  allow(["categories", "markets"]),
  updateCategoryStatus
);

// Create new product category (Admin only)
productCategoryRoutes.post(
  "/",
  isAuthenticated,
  allow(["categories", "markets"]),
  createProductCategory
);

// Get all product categories with filtering and pagination
productCategoryRoutes.get(
  "/",
  isAuthenticated,
  allow(["categories", "markets", "products"], "AGGREGATOR", "LOGISTICS"),
  getAllProductCategories
);

// Get product category by ID
productCategoryRoutes.get("/:categoryId", getProductCategoryById);

// Update product category (Admin only)
productCategoryRoutes.patch(
  "/:categoryId",
  isAuthenticated,
  allow(["categories", "markets"]),
  updateProductCategory
);

// Delete product category (Admin only)
productCategoryRoutes.delete(
  "/:categoryId",
  isAuthenticated,
  allow(["categories", "markets"]),
  deleteProductCategory
);

export default productCategoryRoutes;
