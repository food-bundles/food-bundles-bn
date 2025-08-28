"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const product_category_controller_1 = require("../controllers/product_category.controller");
const authMiddleware_1 = require("../middleware/authMiddleware");
const productCategoryRoutes = (0, express_1.Router)();
// Get active categories for dropdown/selection (accessible to authenticated users)
productCategoryRoutes.get("/active", product_category_controller_1.getActiveProductCategories);
// Bulk update category status (Admin only)
productCategoryRoutes.patch("/bulk-status", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("ADMIN"), product_category_controller_1.updateCategoryStatus);
// Create new product category (Admin only)
productCategoryRoutes.post("/", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("ADMIN"), product_category_controller_1.createProductCategory);
// Get all product categories with filtering and pagination
productCategoryRoutes.get("/", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("ADMIN", "AGGREGATOR", "LOGISTICS"), product_category_controller_1.getAllProductCategories);
// Get product category by ID
productCategoryRoutes.get("/:categoryId", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("ADMIN", "AGGREGATOR", "LOGISTICS"), product_category_controller_1.getProductCategoryById);
// Update product category (Admin only)
productCategoryRoutes.patch("/:categoryId", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("ADMIN"), product_category_controller_1.updateProductCategory);
// Delete product category (Admin only)
productCategoryRoutes.delete("/:categoryId", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("ADMIN"), product_category_controller_1.deleteProductCategory);
exports.default = productCategoryRoutes;
