import { Router } from "express";
import {
  getRevenue,
  getExpense,
  getSalesSummary,
  getSalesAnalytics,
} from "../controllers/sales.controller";
import { isAuthenticated, checkPermission } from "../middleware/authMiddleware";

const salesRoutes = Router();

// Get revenue data (Admin only)
salesRoutes.get(
  "/revenue",
  isAuthenticated,
  checkPermission("ADMIN"),
  getRevenue
);

// Get expense data (Admin only)
salesRoutes.get(
  "/expense",
  isAuthenticated,
  checkPermission("ADMIN"),
  getExpense
);

// Get sales summary (Admin only)
salesRoutes.get(
  "/summary",
  isAuthenticated,
  checkPermission("ADMIN"),
  getSalesSummary
);

// Get sales analytics (Admin only)
salesRoutes.get(
  "/analytics",
  isAuthenticated,
  checkPermission("ADMIN"),
  getSalesAnalytics
);

export default salesRoutes;