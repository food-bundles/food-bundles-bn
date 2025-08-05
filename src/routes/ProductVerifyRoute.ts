import { Router } from "express";
import ProductVerifyController from "../controllers/ProductVerifyController";
import { checkPermission, isAuthenticated } from "../middleware/authMiddleware";
import { Role } from "@prisma/client";

const ProductverifyRoutes = Router();

ProductverifyRoutes.post(
  "/submissions/:submissionId/purchase",
  isAuthenticated,
  checkPermission(Role.FOOD_BUNDLE, Role.ADMIN),
  ProductVerifyController.purchaseProduct
);

ProductverifyRoutes.put(
  "/product/:submissionId/update",
  isAuthenticated,
  checkPermission(Role.FOOD_BUNDLE, Role.ADMIN),
  ProductVerifyController.updateSubmission
);

ProductverifyRoutes.put(
  "/submissions/:submissionId/clear",
  isAuthenticated,
  checkPermission(Role.FOOD_BUNDLE, Role.ADMIN),
  ProductVerifyController.clearSubmission
);

//Get all submissions role-based
ProductverifyRoutes.get(
  "/submissions",
  isAuthenticated,
  ProductVerifyController.getAllSubmissions
);

// Get specific submission by ID role-based 
ProductverifyRoutes.get(
  "/submissions/:submissionId",
  isAuthenticated,
  ProductVerifyController.getSubmissionById
);


// Get submissions by status
ProductverifyRoutes.get(
  "/submissions/status/:status",
  isAuthenticated,
  ProductVerifyController.getSubmissionsByStatus
);

// farmers only
ProductverifyRoutes.get(
  "/submissions/my-submissions",
  isAuthenticated,
  checkPermission(Role.FARMER),
  ProductVerifyController.getMySubmissions
);

// dashboard data
ProductverifyRoutes.get(
  "/submissions/stats",
  isAuthenticated,
  ProductVerifyController.getSubmissionStats
);


export default ProductverifyRoutes;
