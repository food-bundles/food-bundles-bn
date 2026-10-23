import { Router } from "express";
import { UserController } from "../controllers/userController";
import { Role } from "@prisma/client";
import {
  isAuthenticated,
  checkPermission,
  allow,
  superAdminOnly,
} from "../middleware/authMiddleware";
import FarmerController, {
  submitProductController,
  adminCreateSubmissionController,
} from "../controllers/farmer.controller";

const farmersRoutes = Router();

farmersRoutes.post(
  "/submit-product/:productId",
  isAuthenticated,
  submitProductController
);

// Admin creates a submission on behalf of a farmer
farmersRoutes.post(
  "/admin-create-submission",
  isAuthenticated,
  allow("farmer_submissions"),
  adminCreateSubmissionController
);

// Get pending feedback submissions (farmers only)
farmersRoutes.get(
  "/pending-feedback",
  isAuthenticated,
  checkPermission(Role.FARMER),
  FarmerController.getPendingFeedbackSubmissions
);

// Get farmer's feedback history (farmers only)
farmersRoutes.get(
  "/feedback-history",
  isAuthenticated,
  checkPermission(Role.FARMER),
  FarmerController.getFarmerFeedbackHistory
);

// Submit farmer feedback on a specific submission
farmersRoutes.post(
  "/:submissionId/feedback",
  isAuthenticated,
  checkPermission(Role.FARMER),
  FarmerController.submitFarmerFeedback
);

// Update farmer feedback (before deadline)
farmersRoutes.patch(
  "/:submissionId/feedback",
  isAuthenticated,
  checkPermission(Role.FARMER),
  FarmerController.updateFarmerFeedback
);

farmersRoutes.post("/", UserController.createFarmer);
farmersRoutes.post("/admin/create", isAuthenticated, allow.to("farmers.create"), UserController.createFarmerByAdmin);
farmersRoutes.get("/", UserController.getAllFarmers);
farmersRoutes.get("/:id", UserController.getFarmerById);
// Edit: the farmer themselves or farmers.edit; delete (to trash): super admin
farmersRoutes.put("/:id", isAuthenticated, UserController.updateFarmer);
farmersRoutes.delete("/:id", isAuthenticated, superAdminOnly, UserController.deleteFarmer);

export default farmersRoutes;
