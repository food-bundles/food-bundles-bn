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
import { isAuthenticated, allow } from "../middleware/authMiddleware";
import productImagesUpload from "../middleware/multer";

const productRoutes = Router();

productRoutes.get(
  "/role-based",
  isAuthenticated,
  allow("products", "AGGREGATOR", "LOGISTICS"), // Allow these roles
  getProductsByRole
);

// Create new product (Admin only)
productRoutes.post(
  "/",
  isAuthenticated,
  allow("products"),
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
  allow("products"),
  productImagesUpload,
  updateProduct
);

productRoutes.delete(
  "/:productId",
  isAuthenticated,
  allow("products"),
  deleteProduct
);

// Update product status (Admin only)
productRoutes.patch(
  "/:productId/status",
  isAuthenticated,
  allow("products"),
  updateProductStatus
);

export default productRoutes;
