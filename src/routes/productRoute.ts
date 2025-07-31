import { Router } from "express";
import {
  createProductFromSubmission,
  //   updateProduct,
  deleteProduct,
  getAllProducts,
  getProductById,
  getVerifiedSubmissions,
  approveSubmission,
} from "../controllers/productController";
import { isAuthenticated, checkPermission } from "../middleware/authMiddleware";
import { upload, validateImages } from "../utils/imageUpload";

const productRoutes = Router();

// Get all products (accessible by all authenticated users)
productRoutes.get("/products",  getAllProducts);

// Get product by ID (accessible by all authenticated users)
productRoutes.get("/products/:productId", getProductById);

// Get verified submissions ready for admin approval
productRoutes.get(
  "/submissions/verified",
  isAuthenticated,
  checkPermission("ADMIN"),
  getVerifiedSubmissions
);

productRoutes.post(
  "/submissions/:submissionId/create-product",
  isAuthenticated,
  checkPermission("ADMIN"),
  upload.array("images", 4),
  validateImages,
  createProductFromSubmission
);

productRoutes.patch(
  "/submissions/:submissionId/approve",
  isAuthenticated,
  checkPermission("ADMIN"),
  approveSubmission
);

// Update product (Admin only)
// productRoutes.put(
//   "/admin/products/:productId",
//   isAuthenticated,
//   checkPermission("ADMIN"),
//   upload.array("images", 4),
//   validateImages,
//   updateProduct
// );

productRoutes.delete(
  "/products/:productId",
  isAuthenticated,
  checkPermission("ADMIN"),
  deleteProduct
);

export default productRoutes;
