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
import { isAuthenticated, allow } from "../middleware/authMiddleware";

const paymentMethodRoutes = Router();

// Get active payment methods for dropdown/selection (accessible to authenticated users)
paymentMethodRoutes.get("/active", getActivePaymentMethods);

// Bulk update method status (Admin only)
paymentMethodRoutes.patch(
  "/bulk-status",
  isAuthenticated,
  allow("payment_methods"),
  updateMethodStatus
);

// Create new payment method (Admin only)
paymentMethodRoutes.post(
  "/",
  isAuthenticated,
  allow("payment_methods"),
  createPaymentMethod
);

// Get all payment methods with filtering and pagination
paymentMethodRoutes.get(
  "/",
  isAuthenticated,
  allow(["payment_methods", "orders"], "AGGREGATOR", "LOGISTICS"),
  getAllPaymentMethods
);

// Get payment method by ID
paymentMethodRoutes.get("/:methodId", getPaymentMethodById);

// Update payment method (Admin only)
paymentMethodRoutes.patch(
  "/:methodId",
  isAuthenticated,
  allow("payment_methods"),
  updatePaymentMethod
);

// Delete payment method (Admin only)
paymentMethodRoutes.delete(
  "/:methodId",
  isAuthenticated,
  allow("payment_methods"),
  deletePaymentMethod
);

export default paymentMethodRoutes;
