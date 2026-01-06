import { Router } from "express";
import {
  createPaymentMethod,
  getAllPaymentMethods,
  getActivePaymentMethods,
  getPaymentMethodById,
  updatePaymentMethod,
  deletePaymentMethod,
  updateMethodStatus,
} from "../controllers/payment-method.controller";
import { isAuthenticated, checkPermission } from "../middleware/authMiddleware";

const paymentMethodRoutes = Router();

// Get active payment methods for dropdown/selection (accessible to authenticated users)
paymentMethodRoutes.get("/active", getActivePaymentMethods);

// Bulk update method status (Admin only)
paymentMethodRoutes.patch(
  "/bulk-status",
  isAuthenticated,
  checkPermission("ADMIN"),
  updateMethodStatus
);

// Create new payment method (Admin only)
paymentMethodRoutes.post(
  "/",
  isAuthenticated,
  checkPermission("ADMIN"),
  createPaymentMethod
);

// Get all payment methods with filtering and pagination
paymentMethodRoutes.get(
  "/",
  isAuthenticated,
  checkPermission("ADMIN", "AGGREGATOR", "LOGISTICS"),
  getAllPaymentMethods
);

// Get payment method by ID
paymentMethodRoutes.get("/:methodId", getPaymentMethodById);

// Update payment method (Admin only)
paymentMethodRoutes.patch(
  "/:methodId",
  isAuthenticated,
  checkPermission("ADMIN"),
  updatePaymentMethod
);

// Delete payment method (Admin only)
paymentMethodRoutes.delete(
  "/:methodId",
  isAuthenticated,
  checkPermission("ADMIN"),
  deletePaymentMethod
);

export default paymentMethodRoutes;
