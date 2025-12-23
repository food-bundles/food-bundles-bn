import { Request, Response } from "express";
import {
  getSystemStatsService,
  getUserStatsService,
  getOrderStatsService,
  getFinanceStatsService,
  getSubscriptionStatsService,
  getVoucherStatsService,
  getQuickStatsService,
  getRecentActivitiesService,
  getSystemStatusService,
} from "../services/stats.service";

// ============================================
// MAIN DASHBOARD STATS CONTROLLER
// ============================================

/**
 * Get comprehensive system statistics for dashboard
 * GET /stats/dashboard
 */
export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const { year, month } = req.query;

    // Validate year and month if provided
    const currentYear = new Date().getFullYear();
    const parsedYear = year ? parseInt(year as string) : currentYear;
    const parsedMonth = month ? parseInt(month as string) : undefined;

    if (parsedYear < 2020 || parsedYear > currentYear + 1) {
      return res.status(400).json({
        message: "Invalid year. Year must be between 2020 and next year.",
      });
    }

    if (parsedMonth && (parsedMonth < 1 || parsedMonth > 12)) {
      return res.status(400).json({
        message: "Invalid month. Month must be between 1 and 12.",
      });
    }

    const stats = await getSystemStatsService({
      year: parsedYear,
      month: parsedMonth,
    });

    res.status(200).json({
      message: "Dashboard statistics retrieved successfully",
      data: stats,
    });
  } catch (error: any) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({
      message: error.message || "Failed to retrieve dashboard statistics",
    });
  }
};

// ============================================
// INDIVIDUAL STATS CONTROLLERS
// ============================================

/**
 * Get user statistics
 * GET /stats/users
 */
export const getUserStats = async (req: Request, res: Response) => {
  try {
    const { year, month, dateFrom, dateTo } = req.query;

    // Calculate date ranges
    const currentYear = new Date().getFullYear();
    const parsedYear = year ? parseInt(year as string) : currentYear;
    const parsedMonth = month ? parseInt(month as string) : undefined;

    let startDate: Date;
    let endDate: Date;

    if (dateFrom && dateTo) {
      startDate = new Date(dateFrom as string);
      endDate = new Date(dateTo as string);
    } else if (parsedMonth) {
      startDate = new Date(parsedYear, parsedMonth - 1, 1);
      endDate = new Date(parsedYear, parsedMonth, 0, 23, 59, 59);
    } else {
      startDate = new Date(parsedYear, 0, 1);
      endDate = new Date(parsedYear, 11, 31, 23, 59, 59);
    }

    // Previous period for comparison
    const periodDiff = endDate.getTime() - startDate.getTime();
    const prevStartDate = new Date(startDate.getTime() - periodDiff);
    const prevEndDate = new Date(endDate.getTime() - periodDiff);

    const isMonthly = !!parsedMonth;

    const userStats = await getUserStatsService({
      dateFrom: startDate,
      dateTo: endDate,
      prevDateFrom: prevStartDate,
      prevDateTo: prevEndDate,
      isMonthly,
    });

    res.status(200).json({
      message: "User statistics retrieved successfully",
      data: userStats,
      filters: {
        year: parsedYear,
        month: parsedMonth,
        dateFrom: startDate,
        dateTo: endDate,
      },
    });
  } catch (error: any) {
    console.error("Error fetching user stats:", error);
    res.status(500).json({
      message: error.message || "Failed to retrieve user statistics",
    });
  }
};

/**
 * Get order statistics
 * GET /stats/orders
 */
export const getOrderStats = async (req: Request, res: Response) => {
  try {
    const { year, month, dateFrom, dateTo } = req.query;

    // Calculate date ranges
    const currentYear = new Date().getFullYear();
    const parsedYear = year ? parseInt(year as string) : currentYear;
    const parsedMonth = month ? parseInt(month as string) : undefined;

    let startDate: Date;
    let endDate: Date;

    if (dateFrom && dateTo) {
      startDate = new Date(dateFrom as string);
      endDate = new Date(dateTo as string);
    } else if (parsedMonth) {
      startDate = new Date(parsedYear, parsedMonth - 1, 1);
      endDate = new Date(parsedYear, parsedMonth, 0, 23, 59, 59);
    } else {
      startDate = new Date(parsedYear, 0, 1);
      endDate = new Date(parsedYear, 11, 31, 23, 59, 59);
    }

    // Previous period for comparison
    const periodDiff = endDate.getTime() - startDate.getTime();
    const prevStartDate = new Date(startDate.getTime() - periodDiff);
    const prevEndDate = new Date(endDate.getTime() - periodDiff);

    const isMonthly = !!parsedMonth;

    const orderStats = await getOrderStatsService({
      dateFrom: startDate,
      dateTo: endDate,
      prevDateFrom: prevStartDate,
      prevDateTo: prevEndDate,
      isMonthly,
    });

    res.status(200).json({
      message: "Order statistics retrieved successfully",
      data: orderStats,
      filters: {
        year: parsedYear,
        month: parsedMonth,
        dateFrom: startDate,
        dateTo: endDate,
      },
    });
  } catch (error: any) {
    console.error("Error fetching order stats:", error);
    res.status(500).json({
      message: error.message || "Failed to retrieve order statistics",
    });
  }
};

/**
 * Get finance statistics
 * GET /stats/finance
 */
export const getFinanceStats = async (req: Request, res: Response) => {
  try {
    const { year, month, dateFrom, dateTo } = req.query;

    // Calculate date ranges
    const currentYear = new Date().getFullYear();
    const parsedYear = year ? parseInt(year as string) : currentYear;
    const parsedMonth = month ? parseInt(month as string) : undefined;

    let startDate: Date;
    let endDate: Date;

    if (dateFrom && dateTo) {
      startDate = new Date(dateFrom as string);
      endDate = new Date(dateTo as string);
    } else if (parsedMonth) {
      startDate = new Date(parsedYear, parsedMonth - 1, 1);
      endDate = new Date(parsedYear, parsedMonth, 0, 23, 59, 59);
    } else {
      startDate = new Date(parsedYear, 0, 1);
      endDate = new Date(parsedYear, 11, 31, 23, 59, 59);
    }

    const isMonthly = !!parsedMonth;

    const financeStats = await getFinanceStatsService({
      dateFrom: startDate,
      dateTo: endDate,
      isMonthly,
    });

    res.status(200).json({
      message: "Finance statistics retrieved successfully",
      data: financeStats,
      filters: {
        year: parsedYear,
        month: parsedMonth,
        dateFrom: startDate,
        dateTo: endDate,
      },
    });
  } catch (error: any) {
    console.error("Error fetching finance stats:", error);
    res.status(500).json({
      message: error.message || "Failed to retrieve finance statistics",
    });
  }
};

/**
 * Get subscription statistics
 * GET /stats/subscriptions
 */
export const getSubscriptionStats = async (req: Request, res: Response) => {
  try {
    const { year, month, dateFrom, dateTo } = req.query;

    // Calculate date ranges
    const currentYear = new Date().getFullYear();
    const parsedYear = year ? parseInt(year as string) : currentYear;
    const parsedMonth = month ? parseInt(month as string) : undefined;

    let startDate: Date;
    let endDate: Date;

    if (dateFrom && dateTo) {
      startDate = new Date(dateFrom as string);
      endDate = new Date(dateTo as string);
    } else if (parsedMonth) {
      startDate = new Date(parsedYear, parsedMonth - 1, 1);
      endDate = new Date(parsedYear, parsedMonth, 0, 23, 59, 59);
    } else {
      startDate = new Date(parsedYear, 0, 1);
      endDate = new Date(parsedYear, 11, 31, 23, 59, 59);
    }

    // Previous period for comparison
    const periodDiff = endDate.getTime() - startDate.getTime();
    const prevStartDate = new Date(startDate.getTime() - periodDiff);
    const prevEndDate = new Date(endDate.getTime() - periodDiff);

    const subscriptionStats = await getSubscriptionStatsService({
      dateFrom: startDate,
      dateTo: endDate,
      prevDateFrom: prevStartDate,
      prevDateTo: prevEndDate,
    });

    res.status(200).json({
      message: "Subscription statistics retrieved successfully",
      data: subscriptionStats,
      filters: {
        year: parsedYear,
        month: parsedMonth,
        dateFrom: startDate,
        dateTo: endDate,
      },
    });
  } catch (error: any) {
    console.error("Error fetching subscription stats:", error);
    res.status(500).json({
      message: error.message || "Failed to retrieve subscription statistics",
    });
  }
};

/**
 * Get voucher statistics
 * GET /stats/vouchers
 */
export const getVoucherStats = async (req: Request, res: Response) => {
  try {
    const { year, month, dateFrom, dateTo } = req.query;

    // Calculate date ranges
    const currentYear = new Date().getFullYear();
    const parsedYear = year ? parseInt(year as string) : currentYear;
    const parsedMonth = month ? parseInt(month as string) : undefined;

    let startDate: Date;
    let endDate: Date;

    if (dateFrom && dateTo) {
      startDate = new Date(dateFrom as string);
      endDate = new Date(dateTo as string);
    } else if (parsedMonth) {
      startDate = new Date(parsedYear, parsedMonth - 1, 1);
      endDate = new Date(parsedYear, parsedMonth, 0, 23, 59, 59);
    } else {
      startDate = new Date(parsedYear, 0, 1);
      endDate = new Date(parsedYear, 11, 31, 23, 59, 59);
    }

    // Previous period for comparison
    const periodDiff = endDate.getTime() - startDate.getTime();
    const prevStartDate = new Date(startDate.getTime() - periodDiff);
    const prevEndDate = new Date(endDate.getTime() - periodDiff);

    const isMonthly = !!parsedMonth;

    const voucherStats = await getVoucherStatsService({
      dateFrom: startDate,
      dateTo: endDate,
      prevDateFrom: prevStartDate,
      prevDateTo: prevEndDate,
      isMonthly,
    });

    res.status(200).json({
      message: "Voucher statistics retrieved successfully",
      data: voucherStats,
      filters: {
        year: parsedYear,
        month: parsedMonth,
        dateFrom: startDate,
        dateTo: endDate,
      },
    });
  } catch (error: any) {
    console.error("Error fetching voucher stats:", error);
    res.status(500).json({
      message: error.message || "Failed to retrieve voucher statistics",
    });
  }
};

/**
 * Get quick statistics for dashboard cards
 * GET /stats/quick
 */
export const getQuickStats = async (req: Request, res: Response) => {
  try {
    const { year, month, dateFrom, dateTo } = req.query;

    // Calculate date ranges
    const currentYear = new Date().getFullYear();
    const parsedYear = year ? parseInt(year as string) : currentYear;
    const parsedMonth = month ? parseInt(month as string) : undefined;

    let startDate: Date;
    let endDate: Date;

    if (dateFrom && dateTo) {
      startDate = new Date(dateFrom as string);
      endDate = new Date(dateTo as string);
    } else if (parsedMonth) {
      startDate = new Date(parsedYear, parsedMonth - 1, 1);
      endDate = new Date(parsedYear, parsedMonth, 0, 23, 59, 59);
    } else {
      startDate = new Date(parsedYear, 0, 1);
      endDate = new Date(parsedYear, 11, 31, 23, 59, 59);
    }

    // Previous period for comparison
    const periodDiff = endDate.getTime() - startDate.getTime();
    const prevStartDate = new Date(startDate.getTime() - periodDiff);
    const prevEndDate = new Date(endDate.getTime() - periodDiff);

    const quickStats = await getQuickStatsService({
      dateFrom: startDate,
      dateTo: endDate,
      prevDateFrom: prevStartDate,
      prevDateTo: prevEndDate,
    });

    res.status(200).json({
      message: "Quick statistics retrieved successfully",
      data: quickStats,
      filters: {
        year: parsedYear,
        month: parsedMonth,
        dateFrom: startDate,
        dateTo: endDate,
      },
    });
  } catch (error: any) {
    console.error("Error fetching quick stats:", error);
    res.status(500).json({
      message: error.message || "Failed to retrieve quick statistics",
    });
  }
};

/**
 * Get recent activities
 * GET /stats/activities
 */
export const getRecentActivities = async (req: Request, res: Response) => {
  try {
    const activities = await getRecentActivitiesService();

    res.status(200).json({
      message: "Recent activities retrieved successfully",
      data: activities,
    });
  } catch (error: any) {
    console.error("Error fetching recent activities:", error);
    res.status(500).json({
      message: error.message || "Failed to retrieve recent activities",
    });
  }
};

/**
 * Get system status
 * GET /stats/system-status
 */
export const getSystemStatus = async (req: Request, res: Response) => {
  try {
    const systemStatus = await getSystemStatusService();

    res.status(200).json({
      message: "System status retrieved successfully",
      data: systemStatus,
    });
  } catch (error: any) {
    console.error("Error fetching system status:", error);
    res.status(500).json({
      message: error.message || "Failed to retrieve system status",
    });
  }
};
