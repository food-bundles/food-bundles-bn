import { Router } from "express";
import ProductVerifyController from "../controllers/ProductVerifyController";
import SubmissionPayoutController from "../controllers/submissionPayout.controller";
import { Role } from "@prisma/client";
import {
  createProductFromSubmission,
  getVerifiedSubmissions,
  approveSubmission,
  updateProductQuantityFromSubmission,
} from "../controllers/productController";
import { isAuthenticated, checkPermission, allow } from "../middleware/authMiddleware";
import { upload, validateImages } from "../utils/imageUpload";

const submissionsRoutes = Router();

// Get verified submissions ready for admin approval (move this BEFORE parameterized routes)
submissionsRoutes.get(
  "/verified",
  isAuthenticated,
  allow("farmer_submissions"),
  getVerifiedSubmissions
);

// Get submissions awaiting feedback (aggregators/admins)
submissionsRoutes.get(
  "/awaiting-feedback",
  isAuthenticated,
  allow("farmer_submissions", "AGGREGATOR"),
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
  allow("farmer_submissions"),
  updateProductQuantityFromSubmission
);

// Create product from submission
submissionsRoutes.post(
  "/:submissionId/create-product",
  isAuthenticated,
  allow("farmer_submissions"),
  upload.array("images", 4),
  validateImages,
  createProductFromSubmission
);

// Approve submission
submissionsRoutes.patch(
  "/:submissionId/approve",
  isAuthenticated,
  allow("farmer_submissions"),
  approveSubmission
);

// Purchase product from submission
submissionsRoutes.post(
  "/:submissionId/purchase",
  isAuthenticated,
  allow("farmer_submissions", "AGGREGATOR"),
  ProductVerifyController.purchaseProduct
);

// Clear submission
submissionsRoutes.put(
  "/:submissionId/clear",
  isAuthenticated,
  allow("farmer_submissions", "AGGREGATOR"),
  ProductVerifyController.clearSubmission
);

// Reject a submission (admin-side, independent of farmer's own feedback flow)
submissionsRoutes.patch(
  "/:submissionId/reject",
  isAuthenticated,
  allow("farmer_submissions"),
  SubmissionPayoutController.reject
);

// Delete a submission (pre-approval only)
submissionsRoutes.delete(
  "/:submissionId",
  isAuthenticated,
  allow("farmer_submissions"),
  SubmissionPayoutController.deleteSubmission
);

// Force-complete a submission without waiting for farmer feedback
submissionsRoutes.patch(
  "/:submissionId/force-complete",
  isAuthenticated,
  allow("farmer_submissions"),
  SubmissionPayoutController.forceComplete
);

// Reverse a submission's status (admin override + audit trail)
submissionsRoutes.patch(
  "/:submissionId/reverse-status",
  isAuthenticated,
  allow("farmer_submissions"),
  SubmissionPayoutController.reverseStatus
);

// Get a submission's status change history
submissionsRoutes.get(
  "/:submissionId/status-history",
  isAuthenticated,
  allow("farmer_submissions", "AGGREGATOR"),
  SubmissionPayoutController.getStatusHistory
);

// Initiate a PayPack cashout payout for an APPROVED submission
submissionsRoutes.post(
  "/:submissionId/payout",
  isAuthenticated,
  allow("farmer_submissions", "AGGREGATOR"),
  SubmissionPayoutController.initiatePayout
);

// Confirm (or mark failed) a pending payout
submissionsRoutes.patch(
  "/:submissionId/payout/:payoutId/confirm",
  isAuthenticated,
  allow("farmer_submissions"),
  SubmissionPayoutController.confirmPayout
);

// List payouts for a submission
submissionsRoutes.get(
  "/:submissionId/payouts",
  isAuthenticated,
  allow("farmer_submissions", "AGGREGATOR"),
  SubmissionPayoutController.getPayouts
);

// Get specific submission by ID role-based (keep this last among GET routes)
submissionsRoutes.get(
  "/:submissionId",
  isAuthenticated,
  ProductVerifyController.getSubmissionById
);

export default submissionsRoutes;
