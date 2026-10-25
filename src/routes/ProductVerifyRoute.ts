import { Router } from "express";
import ProductVerifyController from "../controllers/ProductVerifyController";
import { isAuthenticated, allow } from "../middleware/authMiddleware";
import { Role } from "@prisma/client";

const ProductverifyRoutes = Router();

ProductverifyRoutes.put(
  "/product/:submissionId/update",
  isAuthenticated,
  allow.to("farmer_submissions.edit"),
  ProductVerifyController.updateSubmission
);

export default ProductverifyRoutes;
