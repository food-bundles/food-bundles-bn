import { Router } from "express";
import ProductVerifyController from "../controllers/ProductVerifyController";
import { Role } from "@prisma/client";
import {
  createProductFromSubmission,
  getVerifiedSubmissions,
  approveSubmission,
  updateProductQuantityFromSubmission,
} from "../controllers/productController";
import { isAuthenticated, checkPermission } from "../middleware/authMiddleware";
import { upload, validateImages } from "../utils/imageUpload";

const submissionsRoutes = Router();

// Get verified submissions ready for admin approval (move this BEFORE parameterized routes)
submissionsRoutes.get(
  "/verified",
  isAuthenticated,
  checkPermission("ADMIN"),
  getVerifiedSubmissions
);

// Get submissions awaiting feedback (aggregators/admins)
submissionsRoutes.get(
  "/awaiting-feedback",
  isAuthenticated,
  checkPermission(Role.AGGREGATOR, Role.ADMIN),
  ProductVerifyController.getSubmissionsAwaitingFeedback
);

// Get submissions by status (move this BEFORE parameterized routes)
submissionsRoutes.get(
  "/status/:status",
  isAuthenticated,
  ProductVerifyController.getSubmissionsByStatus
);

// farmers only (move this BEFORE parameterized routes)
submissionsRoutes.get(
  "/my-submissions",
  isAuthenticated,
  checkPermission(Role.FARMER),
  ProductVerifyController.getMySubmissions
);

// dashboard data (move this BEFORE parameterized routes)
submissionsRoutes.get(
  "/stats",
  isAuthenticated,
  ProductVerifyController.getSubmissionStats
);

// Get all submissions role-based (move this BEFORE parameterized routes)
submissionsRoutes.get(
  "/",
  isAuthenticated,
  ProductVerifyController.getAllSubmissions
);

// Update product quantity from submission (Admin only)
submissionsRoutes.patch(
  "/:submissionId/products/:productId/update-quantity",
  isAuthenticated,
  checkPermission("ADMIN"),
  updateProductQuantityFromSubmission
);

// Create product from submission
submissionsRoutes.post(
  "/:submissionId/create-product",
  isAuthenticated,
  checkPermission("ADMIN"),
  upload.array("images", 4),
  validateImages,
  createProductFromSubmission
);

// Approve submission
submissionsRoutes.patch(
  "/:submissionId/approve",
  isAuthenticated,
  checkPermission("ADMIN"),
  approveSubmission
);

// Purchase product from submission
submissionsRoutes.post(
  "/:submissionId/purchase",
  isAuthenticated,
  checkPermission(Role.AGGREGATOR, Role.ADMIN),
  ProductVerifyController.purchaseProduct
);

// Clear submission
submissionsRoutes.put(
  "/:submissionId/clear",
  isAuthenticated,
  checkPermission(Role.AGGREGATOR, Role.ADMIN),
  ProductVerifyController.clearSubmission
);

// Get specific submission by ID role-based (keep this last among GET routes)
submissionsRoutes.get(
  "/:submissionId",
  isAuthenticated,
  ProductVerifyController.getSubmissionById
);

export default submissionsRoutes;
