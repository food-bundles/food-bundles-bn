import { Router } from "express";
import {
  updateProduct,
  deleteProduct,
  getAllProducts,
  getProductById,
  createProduct,
  getProductsByRole,
  updateProductStatus,
  getDiscountedProducts,
} from "../controllers/productController";
import { isAuthenticated, checkPermission } from "../middleware/authMiddleware";
import productImagesUpload from "../middleware/multer";

const productRoutes = Router();

productRoutes.get(
  "/role-based",
  isAuthenticated,
  checkPermission("ADMIN", "AGGREGATOR", "LOGISTICS"), // Allow these roles
  getProductsByRole
);

// Create new product (Admin only)
productRoutes.post(
  "/",
  isAuthenticated,
  checkPermission("ADMIN"),
  productImagesUpload,
  createProduct
);

// Get discounted products only
productRoutes.get("/discounted", getDiscountedProducts);

// Get all products (accessible by all authenticated)
productRoutes.get("/", getAllProducts);

// Get product by ID (accessible by all authenticated users)
productRoutes.get("/:productId", getProductById);

// Update product (Admin only)
productRoutes.patch(
  "/:productId",
  isAuthenticated,
  checkPermission("ADMIN"),
  productImagesUpload,
  updateProduct
);

productRoutes.delete(
  "/:productId",
  isAuthenticated,
  checkPermission("ADMIN"),
  deleteProduct
);

// Update product status (Admin only)
productRoutes.patch(
  "/:productId/status",
  isAuthenticated,
  checkPermission("ADMIN"),
  updateProductStatus
);

export default productRoutes;
