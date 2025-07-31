import { Router } from "express";
import {
  purchaseProduct,
  updateSubmission,
  clearSubmission,
  getAllSubmissions,
  getSubmissionById,
} from "../controllers/ProductVerifyController";
import { checkPermission, isAuthenticated } from "../middleware/authMiddleware";
import { Role } from "@prisma/client";

const ProductverifyRoutes = Router();

ProductverifyRoutes.get("/submissions", isAuthenticated, getAllSubmissions);

ProductverifyRoutes.get(
  "/submissions/:submissionId",
  isAuthenticated,
  getSubmissionById
);

ProductverifyRoutes.post(
  "/submissions/:submissionId/purchase",
  isAuthenticated,
  checkPermission(Role.FOOD_BUNDLE, Role.ADMIN),
  purchaseProduct
);

// ProductverifyRoutes.put(
//   "/product/:submissionId/update",
//   isAuthenticated,
//   checkPermission(Role.FOOD_BUNDLE, Role.ADMIN),
//   updateSubmission
// );

ProductverifyRoutes.put(
  "/submissions/:submissionId/clear",
  isAuthenticated,
  checkPermission(Role.FOOD_BUNDLE, Role.ADMIN),
  clearSubmission
);

export default ProductverifyRoutes;
