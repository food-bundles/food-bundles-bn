import { Router } from "express";
import ProductVerifyController from "../controllers/ProductVerifyController";
import { isAuthenticated, allow } from "../middleware/authMiddleware";
import { Role } from "@prisma/client";

const ProductverifyRoutes = Router();

ProductverifyRoutes.put(
  "/product/:submissionId/update",
  isAuthenticated,
  allow("farmer_submissions", "AGGREGATOR"),
  ProductVerifyController.updateSubmission
);

export default ProductverifyRoutes;
