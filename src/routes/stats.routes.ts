import { Router } from "express";
import {
  getDashboardStats,
  getUserStats,
  getOrderStats,
  getFinanceStats,
  getSubscriptionStats,
  getVoucherStats,
  getQuickStats,
  getRecentActivities,
  getSystemStatus,
} from "../controllers/stats.controller";
import { isAuthenticated, checkPermission } from "../middleware/authMiddleware";

const router = Router();

// ============================================
// MAIN DASHBOARD STATS ROUTES
// ============================================

/**
 * @route GET /stats/dashboard
 * @desc Get comprehensive dashboard statistics
 * @access Admin only
 * @query year - Year filter (optional, defaults to current year)
 * @query month - Month filter (optional, 1-12)
 */
router.get(
  "/dashboard",
  isAuthenticated,
  checkPermission("ADMIN"),
  getDashboardStats
);

// ============================================
// INDIVIDUAL STATS ROUTES
// ============================================

/**
 * @route GET /stats/users
 * @desc Get user statistics with growth metrics
 * @access Admin only
 * @query year - Year filter (optional)
 * @query month - Month filter (optional)
 * @query dateFrom - Start date filter (optional)
 * @query dateTo - End date filter (optional)
 */
router.get("/users", isAuthenticated, checkPermission("ADMIN"), getUserStats);

/**
 * @route GET /stats/orders
 * @desc Get order statistics with daily breakdown
 * @access Admin only
 * @query year - Year filter (optional)
 * @query month - Month filter (optional)
 * @query dateFrom - Start date filter (optional)
 * @query dateTo - End date filter (optional)
 */
router.get("/orders", isAuthenticated, checkPermission("ADMIN"), getOrderStats);

/**
 * @route GET /stats/finance
 * @desc Get financial statistics with revenue vs expenses
 * @access Admin only
 * @query year - Year filter (optional)
 * @query month - Month filter (optional)
 * @query dateFrom - Start date filter (optional)
 * @query dateTo - End date filter (optional)
 */
router.get(
  "/finance",
  isAuthenticated,
  checkPermission("ADMIN"),
  getFinanceStats
);

/**
 * @route GET /stats/subscriptions
 * @desc Get subscription statistics with plan breakdown
 * @access Admin only
 * @query year - Year filter (optional)
 * @query month - Month filter (optional)
 * @query dateFrom - Start date filter (optional)
 * @query dateTo - End date filter (optional)
 */
router.get(
  "/subscriptions",
  isAuthenticated,
  checkPermission("ADMIN"),
  getSubscriptionStats
);

/**
 * @route GET /stats/vouchers
 * @desc Get voucher statistics with usage metrics
 * @access Admin only
 * @query year - Year filter (optional)
 * @query month - Month filter (optional)
 * @query dateFrom - Start date filter (optional)
 * @query dateTo - End date filter (optional)
 */
router.get(
  "/vouchers",
  isAuthenticated,
  checkPermission("ADMIN"),
  getVoucherStats
);

/**
 * @route GET /stats/quick
 * @desc Get quick statistics for dashboard cards
 * @access Admin only
 * @query year - Year filter (optional)
 * @query month - Month filter (optional)
 * @query dateFrom - Start date filter (optional)
 * @query dateTo - End date filter (optional)
 */
router.get("/quick", isAuthenticated, checkPermission("ADMIN"), getQuickStats);

/**
 * @route GET /stats/activities
 * @desc Get recent system activities
 * @access Admin only
 */
router.get(
  "/activities",
  isAuthenticated,
  checkPermission("ADMIN"),
  getRecentActivities
);

/**
 * @route GET /stats/system-status
 * @desc Get system health and status information
 * @access Admin only
 */
router.get(
  "/system-status",
  isAuthenticated,
  checkPermission("ADMIN"),
  getSystemStatus
);

export default router;
