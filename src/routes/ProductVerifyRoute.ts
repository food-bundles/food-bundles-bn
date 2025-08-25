import { Router } from "express";
import ProductVerifyController from "../controllers/ProductVerifyController";
import { checkPermission, isAuthenticated } from "../middleware/authMiddleware";
import { Role } from "@prisma/client";

const ProductverifyRoutes = Router();

ProductverifyRoutes.put(
  "/product/:submissionId/update",
  isAuthenticated,
  checkPermission(Role.AGGREGATOR, Role.ADMIN),
  ProductVerifyController.updateSubmission
);

export default ProductverifyRoutes;
