import { Router } from "express";
import { UserController } from "../controllers/userController";
import { Role } from "@prisma/client";
import { isAuthenticated, checkPermission } from "../middleware/authMiddleware";
import FarmerController, {
  submitProductController,
} from "../controllers/farmer.controller";

const farmersRoutes = Router();

farmersRoutes.post(
  "/submit-product/:productId",
  isAuthenticated,
  submitProductController
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
farmersRoutes.get("/", UserController.getAllFarmers);
farmersRoutes.get("/:id", UserController.getFarmerById);
farmersRoutes.put("/:id", UserController.updateFarmer);
farmersRoutes.delete("/:id", UserController.deleteFarmer);

export default farmersRoutes;
