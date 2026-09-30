import { Router } from "express";
import {
  getRevenue,
  getExpense,
  getSalesSummary,
  getSalesAnalytics,
} from "../controllers/sales.controller";
import { isAuthenticated, allow } from "../middleware/authMiddleware";

const salesRoutes = Router();

// Get revenue data (Admin only)
salesRoutes.get(
  "/revenue",
  isAuthenticated,
  allow("sales_reports"),
  getRevenue
);

// Get expense data (Admin only)
salesRoutes.get(
  "/expense",
  isAuthenticated,
  allow("sales_reports"),
  getExpense
);

// Get sales summary (Admin only)
salesRoutes.get(
  "/summary",
  isAuthenticated,
  allow("sales_reports"),
  getSalesSummary
);

// Get sales analytics (Admin only)
salesRoutes.get(
  "/analytics",
  isAuthenticated,
  allow("sales_reports"),
  getSalesAnalytics
);

export default salesRoutes;