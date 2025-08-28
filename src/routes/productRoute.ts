import { Router } from "express";
import {
  updateProduct,
  deleteProduct,
  getAllProducts,
  getProductById,
  createProduct,
  getProductsByRole,
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

export default productRoutes;
